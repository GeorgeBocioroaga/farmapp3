from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db import get_db
from models import Work, Parcel
from schemas import WorkCreate, WorkUpdate
from security import get_current_user

router = APIRouter(tags=["works"])


@router.post("/parcels/{parcel_id}/works")
def create_work(parcel_id: int, payload: WorkCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    work = Work(parcel_id=parcel_id, **payload.dict())
    db.add(work)
    db.commit()
    db.refresh(work)
    return work


@router.get("/parcels/{parcel_id}/works")
def list_works(
    parcel_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Work).filter(Work.parcel_id == parcel_id).order_by(Work.date.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total}


@router.patch("/works/{work_id}")
def update_work(work_id: int, payload: WorkUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    work = db.query(Work).filter(Work.id == work_id).first()
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(work, key, value)
    db.commit()
    db.refresh(work)
    return work
