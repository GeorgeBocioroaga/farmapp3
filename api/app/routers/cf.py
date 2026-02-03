from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import io
import pandas as pd
from db import get_db
from models import CadastreCF, Parcel, Doc
from services import pdf_cf_parser, geo, storage
from security import get_current_user
from geoalchemy2 import WKTElement

router = APIRouter(prefix="/cf", tags=["cf"])


@router.post("/import")
async def import_cf_pdf(
    file: UploadFile = File(...),
    cf_number: str = Form(...),
    parcel_name: Optional[str] = Form(None),
    county: Optional[str] = Form(None),
    locality: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    content = await file.read()
    points = pdf_cf_parser.parse_cf_pdf(content, ocr_endpoint=_ocr_endpoint())
    if len(points) < 3:
        raise HTTPException(status_code=400, detail="Nu s-au găsit suficiente puncte în PDF.")

    points_wgs84 = geo.stereo70_to_wgs84(points)
    polygon = geo.points_to_polygon(points_wgs84)

    cf = db.query(CadastreCF).filter(CadastreCF.cf_number == cf_number).first()
    if not cf:
        cf = CadastreCF(cf_number=cf_number, county=county, locality=locality)
        db.add(cf)
        db.flush()

    area = geo.area_m2(polygon)
    wkt = WKTElement(polygon.wkt, srid=4326)

    parcel = Parcel(
        cf_id=cf.id,
        name=parcel_name or f"CF {cf_number}",
        area_m2=area,
        geom=wkt,
        status="active",
    )
    db.add(parcel)

    doc_key = storage.save_doc(content, file.filename, file.content_type or "application/pdf")
    doc = Doc(path=doc_key, type="cf_pdf")
    db.add(doc)

    db.commit()
    db.refresh(parcel)

    return {
        "cf_id": cf.id,
        "parcel_id": parcel.id,
        "area_m2": area,
        "feature": {
            "type": "Feature",
            "geometry": geo.shape_to_geojson(polygon),
            "properties": {"id": parcel.id, "name": parcel.name, "cf_number": cf.cf_number},
        },
    }


@router.post("/import-excel")
async def import_cf_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    content = await file.read()
    if file.filename.lower().endswith(".csv"):
        df_points = pd.read_csv(io.BytesIO(content))
    else:
        df_points = pd.read_excel(io.BytesIO(content), sheet_name="CF_Points")

    required = {"cf_number", "x_stereo70", "y_stereo70", "order"}
    if not required.issubset(set(df_points.columns)):
        raise HTTPException(status_code=400, detail="Sheet-ul CF_Points trebuie să aibă coloanele: cf_number, x_stereo70, y_stereo70, order")

    results = []
    for cf_number, group in df_points.groupby("cf_number"):
        group_sorted = group.sort_values("order")
        points = list(zip(group_sorted["x_stereo70"].astype(float), group_sorted["y_stereo70"].astype(float)))
        if len(points) < 3:
            continue
        points_wgs84 = geo.stereo70_to_wgs84(points)
        polygon = geo.points_to_polygon(points_wgs84)

        cf = db.query(CadastreCF).filter(CadastreCF.cf_number == cf_number).first()
        if not cf:
            cf = CadastreCF(cf_number=str(cf_number))
            db.add(cf)
            db.flush()

        area = geo.area_m2(polygon)
        wkt = WKTElement(polygon.wkt, srid=4326)
        parcel = Parcel(cf_id=cf.id, name=f"CF {cf_number}", area_m2=area, geom=wkt, status="active")
        db.add(parcel)
        results.append({"cf_number": cf_number, "area_m2": area})

    db.commit()
    return {"imported": len(results), "items": results}


def _ocr_endpoint():
    import os
    return os.getenv("OCR_ENDPOINT", "")
