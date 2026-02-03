from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db import get_db
from models import SoilAnalysis
from schemas import SoilAnalysisCreate
from security import get_current_user

router = APIRouter(prefix="/soil-analyses", tags=["soil"])


@router.post("")
def create_analysis(payload: SoilAnalysisCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    analysis = SoilAnalysis(**payload.dict())
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("")
def list_analyses(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(SoilAnalysis).order_by(SoilAnalysis.date.desc()).all()
