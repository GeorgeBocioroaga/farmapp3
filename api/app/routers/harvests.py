from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from db import get_db
from models import Harvest, HarvestTicket, Doc
from schemas import HarvestCreate
from security import get_current_user
from services import chem_parse, storage
import requests
import os

router = APIRouter(prefix="/harvests", tags=["harvests"])


@router.post("")
def create_harvest(payload: HarvestCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    harvest = Harvest(**payload.dict())
    db.add(harvest)
    db.commit()
    db.refresh(harvest)
    return harvest


@router.get("")
def list_harvests(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Harvest).order_by(Harvest.date.desc()).all()


@router.post("/{harvest_id}/ticket")
async def add_ticket(
    harvest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")
    content = await file.read()
    ocr_endpoint = os.getenv("OCR_ENDPOINT", "")
    if not ocr_endpoint:
        raise HTTPException(status_code=500, detail="OCR service not configured")
    resp = requests.post(
        f"{ocr_endpoint}/ocr",
        files={"file": (file.filename, content, file.content_type or "application/octet-stream")},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    lines = [l.get("text", "") for l in data.get("lines", [])]
    parsed = chem_parse.parse_ticket_lines(lines)

    doc_key = storage.save_doc(content, file.filename, file.content_type or "application/octet-stream")
    doc = Doc(path=doc_key, type="harvest_ticket", ocr_json=str(data))
    db.add(doc)
    db.flush()

    values = parsed.get("values", {})
    ticket = HarvestTicket(
        harvest_id=harvest_id,
        silo_name=values.get("silo_name"),
        qty_t=values.get("qty_t"),
        moisture_pct=values.get("moisture_pct"),
        test_weight=values.get("test_weight"),
        foreign_matter_pct=values.get("foreign_matter_pct"),
        doc_id=doc.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"ticket": ticket, "parsed": parsed}
