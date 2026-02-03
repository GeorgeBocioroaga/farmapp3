from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db import get_db
from models import RasterAsset
from schemas import RasterIngest
from security import get_current_user

router = APIRouter(prefix="/raster", tags=["raster"])


@router.post("/ingest")
def ingest_raster(payload: RasterIngest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    asset = RasterAsset(**payload.dict())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/assets")
def list_assets(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(RasterAsset).all()
