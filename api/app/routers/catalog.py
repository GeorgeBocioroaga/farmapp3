from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from models import CropCatalog, VarietyCatalog, Parcel, ParcelCrop, ActiveSubstance
from schemas import CropCreate, VarietyCreate, ParcelCropCreate, ActiveSubstanceCreate
from security import get_current_user
from services import chem_parse

router = APIRouter(tags=["catalog"])


@router.get("/catalog/crops")
def list_crops(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(CropCatalog).order_by(CropCatalog.crop.asc()).all()


@router.post("/catalog/crops")
def create_crop(payload: CropCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    crop = CropCatalog(**payload.dict())
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


@router.get("/catalog/varieties")
def list_varieties(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(VarietyCatalog).all()


@router.post("/catalog/varieties")
def create_variety(payload: VarietyCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    variety = VarietyCatalog(**payload.dict())
    db.add(variety)
    db.commit()
    db.refresh(variety)
    return variety


@router.get("/catalog/actives")
def list_actives(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(ActiveSubstance).order_by(ActiveSubstance.name.asc()).all()


@router.post("/catalog/actives")
def create_active(payload: ActiveSubstanceCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    canonical = chem_parse.normalize_active_name(payload.name)
    name_norm = chem_parse.normalize_text(canonical).replace(" ", "")
    existing = db.query(ActiveSubstance).filter(ActiveSubstance.name_norm == name_norm).first()
    if existing:
        if payload.aliases:
            existing.aliases = payload.aliases
        db.commit()
        db.refresh(existing)
        return existing
    active = ActiveSubstance(name=canonical, name_norm=name_norm, aliases=payload.aliases)
    db.add(active)
    db.commit()
    db.refresh(active)
    return active


@router.post("/parcels/{parcel_id}/crops")
def add_parcel_crop(parcel_id: int, payload: ParcelCropCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    crop = ParcelCrop(parcel_id=parcel_id, **payload.dict())
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


@router.get("/parcels/{parcel_id}/crops")
def list_parcel_crops(parcel_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(ParcelCrop).filter(ParcelCrop.parcel_id == parcel_id).order_by(ParcelCrop.season_year.desc()).all()
