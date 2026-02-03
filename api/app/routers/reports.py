from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from db import get_db
from security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/active-stock")
def report_active_stock(active: str = Query(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    from routers.inventory import active_stock
    return active_stock(active=active, db=db, user=user)


@router.get("/alerts")
def report_alerts(days: int = Query(90), db: Session = Depends(get_db), user=Depends(get_current_user)):
    sql = """
        SELECT l.id AS lot_id,
               l.product_id,
               l.lot_code,
               l.expires_at,
               l.uom,
               COALESCE(SUM(CASE WHEN t.movement='in' THEN t.qty WHEN t.movement='out' THEN -t.qty ELSE t.qty END),0) AS qty
        FROM stock_lots l
        LEFT JOIN inventory_txns t ON t.lot_id = l.id
        GROUP BY l.id
        HAVING COALESCE(SUM(CASE WHEN t.movement='in' THEN t.qty WHEN t.movement='out' THEN -t.qty ELSE t.qty END),0) > 0
        ORDER BY (l.expires_at IS NULL) ASC, l.expires_at ASC;
    """
    rows = db.execute(text(sql)).mappings().all()
    today = date.today()
    results = []
    for r in rows:
        expires_in = (r["expires_at"] - today).days if r["expires_at"] else None
        if expires_in is not None and expires_in <= days:
            results.append(
                {
                    "lot_id": r["lot_id"],
                    "product_id": r["product_id"],
                    "lot_code": r["lot_code"],
                    "expires_at": r["expires_at"],
                    "uom": r["uom"],
                    "qty": float(r["qty"]),
                    "expires_in_days": expires_in,
                }
            )
    return results
