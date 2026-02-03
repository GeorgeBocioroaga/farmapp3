from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from shapely.geometry import shape
from geoalchemy2 import WKTElement
from db import get_db
from models import Parcel, CadastreCF
from services import geo
from schemas import ParcelCreate, ParcelUpdate
from security import get_current_user

router = APIRouter(prefix="/parcels", tags=["parcels"])


@router.get("")
def list_parcels(
    bbox: Optional[str] = None,
    search: Optional[str] = None,
    zoom: Optional[int] = Query(None, ge=1, le=22),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(
        Parcel.id,
        Parcel.name,
        Parcel.area_m2,
        Parcel.culture,
        Parcel.status,
        Parcel.cf_id,
        CadastreCF.cf_number,
        func.ST_AsGeoJSON(Parcel.geom).label("geojson"),
    ).join(CadastreCF)

    if search:
        like = f"%{search}%"
        query = query.filter((Parcel.name.ilike(like)) | (CadastreCF.cf_number.ilike(like)))

    if bbox:
        try:
            minx, miny, maxx, maxy = [float(x) for x in bbox.split(",")]
        except Exception:
            raise HTTPException(status_code=400, detail="bbox trebuie să fie minx,miny,maxx,maxy")
        envelope = func.ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)
        query = query.filter(func.ST_Intersects(Parcel.geom, envelope))

    total = query.count()
    rows = query.offset(offset).limit(limit).all()

    features = []
    for row in rows:
        geom_obj = None
        if row.geojson:
            try:
                geom_obj = shape(_json_loads(row.geojson))
            except Exception:
                geom_obj = None
        if geom_obj and zoom and zoom < 13:
            tolerance = 0.0003
            geom_obj = geom_obj.simplify(tolerance, preserve_topology=True)
        if geom_obj:
            geom_json = geo.shape_to_geojson(geom_obj)
        else:
            geom_json = None
        features.append(
            {
                "type": "Feature",
                "geometry": geom_json,
                "properties": {
                    "id": row.id,
                    "name": row.name,
                    "area_m2": row.area_m2,
                    "culture": row.culture,
                    "status": row.status,
                    "cf_id": row.cf_id,
                    "cf_number": row.cf_number,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features, "total": total}


@router.get("/{parcel_id}")
def get_parcel(parcel_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = db.query(
        Parcel,
        CadastreCF.cf_number,
        func.ST_AsGeoJSON(Parcel.geom).label("geojson"),
    ).join(CadastreCF).filter(Parcel.id == parcel_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Parcel not found")
    parcel = row[0]
    geom_json = _json_loads(row.geojson) if row.geojson else None
    return {
        "id": parcel.id,
        "cf_id": parcel.cf_id,
        "cf_number": row.cf_number,
        "name": parcel.name,
        "area_m2": parcel.area_m2,
        "culture": parcel.culture,
        "status": parcel.status,
        "geom_geojson": geom_json,
    }


@router.post("")
def create_parcel(payload: ParcelCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    name = payload.name
    geom_geojson = payload.geom_geojson
    if not name or not geom_geojson:
        raise HTTPException(status_code=400, detail="name și geom_geojson sunt obligatorii")

    cf_number = payload.cf_number
    cf_id = payload.cf_id
    cf = None
    if cf_id:
        cf = db.query(CadastreCF).filter(CadastreCF.id == cf_id).first()
    elif cf_number:
        cf = db.query(CadastreCF).filter(CadastreCF.cf_number == cf_number).first()
        if not cf:
            cf = CadastreCF(cf_number=cf_number)
            db.add(cf)
            db.flush()
    if not cf:
        raise HTTPException(status_code=400, detail="cf_id sau cf_number este obligatoriu")

    shape_geom = geo.geojson_to_shape(geom_geojson)
    area = geo.area_m2(shape_geom)
    wkt = WKTElement(shape_geom.wkt, srid=4326)

    parcel = Parcel(
        cf_id=cf.id,
        name=name,
        area_m2=area,
        geom=wkt,
        culture=payload.culture,
        status=payload.status or "active",
    )
    db.add(parcel)
    db.commit()
    db.refresh(parcel)
    return {"id": parcel.id, "area_m2": area}


@router.patch("/{parcel_id}")
def update_parcel(parcel_id: int, payload: ParcelUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    data = payload.dict(exclude_unset=True)
    for field in ["name", "culture", "status"]:
        if field in data:
            setattr(parcel, field, data[field])

    if data.get("geom_geojson"):
        shape_geom = geo.geojson_to_shape(data["geom_geojson"])
        parcel.area_m2 = geo.area_m2(shape_geom)
        parcel.geom = WKTElement(shape_geom.wkt, srid=4326)

    db.commit()
    db.refresh(parcel)
    return {"id": parcel.id, "area_m2": parcel.area_m2}


def _json_loads(text: str):
    import json
    return json.loads(text)
