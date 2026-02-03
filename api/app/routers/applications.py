from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from db import get_db
from models import (
    TankMix,
    TankMixItem,
    Application,
    ApplicationItem,
    InventoryTxn,
    StockLot,
    ChemProduct,
)
from schemas import MixCreate, ApplicationCreate
from security import get_current_user

router = APIRouter(tags=["applications"])


@router.post("/mix")
def create_mix(payload: MixCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Mix-ul trebuie sa aiba cel putin un produs")

    mix = TankMix(
        name=payload.name,
        water_ph=payload.water_ph,
        water_hardness_ppm=payload.water_hardness_ppm,
        notes=payload.notes,
        created_by=getattr(user, "id", None),
    )
    db.add(mix)
    db.flush()

    for item in payload.items:
        if item.dose_per_ha <= 0:
            raise HTTPException(status_code=400, detail="Doza/ha trebuie sa fie > 0")
        if item.uom not in {"L/ha", "kg/ha"}:
            raise HTTPException(status_code=400, detail="UoM trebuie sa fie L/ha sau kg/ha")
        db.add(
            TankMixItem(
                mix_id=mix.id,
                product_id=item.product_id,
                dose_per_ha=item.dose_per_ha,
                uom=item.uom,
            )
        )

    db.commit()
    return {"id": mix.id}


@router.get("/mix")
def list_mix(db: Session = Depends(get_db), user=Depends(get_current_user)):
    mixes = db.query(TankMix).order_by(TankMix.created_at.desc()).all()
    result = []
    for m in mixes:
        items = (
            db.query(TankMixItem)
            .filter(TankMixItem.mix_id == m.id)
            .all()
        )
        result.append(
            {
                "id": m.id,
                "name": m.name,
                "water_ph": m.water_ph,
                "water_hardness_ppm": m.water_hardness_ppm,
                "notes": m.notes,
                "items": [
                    {
                        "product_id": i.product_id,
                        "dose_per_ha": i.dose_per_ha,
                        "uom": i.uom,
                    }
                    for i in items
                ],
            }
        )
    return result


@router.get("/applications")
def list_applications(
    parcel_id: int = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Application)
    if parcel_id:
        query = query.filter(Application.parcel_id == parcel_id)
    return query.order_by(Application.date.desc()).all()


@router.get("/inventory/applications")
def list_inventory_applications(
    parcel_id: int = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return list_applications(parcel_id=parcel_id, db=db, user=user)


@router.post("/applications")
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not payload.items and not payload.mix_id:
        raise HTTPException(status_code=400, detail="Trebuie items sau mix_id")
    if payload.area_ha <= 0:
        raise HTTPException(status_code=400, detail="Suprafata trebuie sa fie > 0")

    items = payload.items
    if payload.mix_id:
        items = (
            db.query(TankMixItem)
            .filter(TankMixItem.mix_id == payload.mix_id)
            .all()
        )
        items = [
            {"product_id": i.product_id, "dose_per_ha": i.dose_per_ha, "uom": i.uom}
            for i in items
        ]

    if not items:
        raise HTTPException(status_code=400, detail="Mix-ul nu are items")

    application = Application(
        parcel_id=payload.parcel_id,
        date=payload.date,
        mix_id=payload.mix_id,
        area_ha=payload.area_ha,
        operator_id=payload.operator_id,
        machine=payload.machine,
        water_l_per_ha=payload.water_l_per_ha,
        tank_volume_l=payload.tank_volume_l,
        status=payload.status or "posted",
    )
    db.add(application)
    db.flush()

    total_cost = 0.0

    for item in items:
        dose = float(item["dose_per_ha"])
        uom = item["uom"]
        if uom not in {"L/ha", "kg/ha"}:
            raise HTTPException(status_code=400, detail="UoM invalid pentru doza")
        qty = dose * payload.area_ha
        product_id = int(item["product_id"])
        base_uom = "l" if uom.lower().startswith("l") else "kg"

        allocations = _allocate_fifo(db, product_id, qty, base_uom)
        if not allocations:
            raise HTTPException(status_code=409, detail=f"Stoc insuficient pentru produsul {product_id}")

        for alloc in allocations:
            lot = db.query(StockLot).filter(StockLot.id == alloc["lot_id"]).first()
            unit_price = getattr(lot, "unit_price", None)
            cost = (unit_price or 0) * alloc["qty"]
            total_cost += cost
            db.add(
                ApplicationItem(
                    application_id=application.id,
                    product_id=product_id,
                    applied_qty=alloc["qty"],
                    uom=base_uom,
                    from_lot_id=alloc["lot_id"],
                    unit_price=unit_price,
                    cost=cost,
                )
            )
            db.add(
                InventoryTxn(
                    lot_id=alloc["lot_id"],
                    movement="out",
                    qty=alloc["qty"],
                    uom=base_uom,
                    date=payload.date,
                    reason="application",
                    ref_id=application.id,
                )
            )

    application.total_cost = total_cost
    db.commit()
    db.refresh(application)
    return application


@router.post("/inventory/applications")
def create_inventory_application(payload: ApplicationCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return create_application(payload=payload, db=db, user=user)


@router.get("/inventory/applications/{app_id}")
def get_inventory_application(app_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Aplicare inexistenta")
    items = db.query(ApplicationItem).filter(ApplicationItem.application_id == app_id).all()
    return {
        "id": app.id,
        "parcel_id": app.parcel_id,
        "date": app.date,
        "area_ha": app.area_ha,
        "total_cost": app.total_cost,
        "status": app.status,
        "items": [
            {
                "product_id": i.product_id,
                "applied_qty": i.applied_qty,
                "uom": i.uom,
                "from_lot_id": i.from_lot_id,
                "unit_price": i.unit_price,
                "cost": i.cost,
            }
            for i in items
        ],
    }


def _allocate_fifo(db: Session, product_id: int, qty: float, uom: str):
    sql = """
        SELECT l.id AS lot_id,
               l.uom,
               l.expires_at,
               l.received_date,
               COALESCE(SUM(CASE WHEN t.movement='in' THEN t.qty WHEN t.movement='out' THEN -t.qty ELSE t.qty END),0) AS qty
        FROM stock_lots l
        LEFT JOIN inventory_txns t ON t.lot_id = l.id
        WHERE l.product_id = :product_id
        GROUP BY l.id
        ORDER BY (l.expires_at IS NULL) ASC, l.expires_at ASC, l.received_date ASC, l.id ASC
    """
    rows = db.execute(text(sql), {"product_id": product_id}).mappings().all()

    remaining = qty
    allocations = []
    for r in rows:
        if remaining <= 0:
            break
        if r["uom"] != uom:
            continue
        available = float(r["qty"] or 0)
        if available <= 0:
            continue
        take = available if available < remaining else remaining
        allocations.append({"lot_id": r["lot_id"], "qty": take})
        remaining -= take

    if remaining > 0:
        return []
    return allocations
