from sqlalchemy.engine import Engine


def ensure_inventory_views(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.exec_driver_sql(
            """
            CREATE OR REPLACE VIEW vw_lot_balance AS
            SELECT
                l.id AS lot_id,
                l.product_id,
                l.uom,
                l.expires_at,
                l.received_date,
                COALESCE(
                    SUM(
                        CASE
                            WHEN t.movement = 'in' THEN t.qty
                            WHEN t.movement = 'out' THEN -t.qty
                            ELSE t.qty
                        END
                    ),
                    0
                ) AS qty
            FROM stock_lots l
            LEFT JOIN inventory_txns t ON t.lot_id = l.id
            GROUP BY l.id;
            """
        )
        conn.exec_driver_sql(
            """
            CREATE OR REPLACE VIEW vw_active_stock AS
            SELECT
                a.id AS active_id,
                a.name AS active_name,
                p.id AS product_id,
                p.trade_name,
                l.id AS lot_id,
                l.lot_code,
                l.expires_at,
                l.uom,
                lb.qty AS lot_qty,
                pa.concentration,
                pa.unit,
                p.density_kg_per_l,
                CASE
                    WHEN lower(l.uom) = 'l' AND pa.unit = 'g/L' THEN lb.qty * pa.concentration / 1000
                    WHEN lower(l.uom) = 'l' AND pa.unit = '%%w/v' THEN lb.qty * pa.concentration / 100
                    WHEN lower(l.uom) = 'l' AND pa.unit = 'g/kg' THEN lb.qty * p.density_kg_per_l * pa.concentration / 1000
                    WHEN lower(l.uom) = 'l' AND pa.unit = '%%w/w' THEN lb.qty * p.density_kg_per_l * pa.concentration / 100
                    WHEN lower(l.uom) = 'kg' AND pa.unit = 'g/kg' THEN lb.qty * pa.concentration / 1000
                    WHEN lower(l.uom) = 'kg' AND pa.unit = '%%w/w' THEN lb.qty * pa.concentration / 100
                    WHEN lower(l.uom) = 'kg' AND pa.unit = 'g/L' THEN (lb.qty / NULLIF(p.density_kg_per_l, 0)) * pa.concentration / 1000
                    WHEN lower(l.uom) = 'kg' AND pa.unit = '%%w/v' THEN (lb.qty / NULLIF(p.density_kg_per_l, 0)) * pa.concentration / 100
                    ELSE NULL
                END AS active_kg
            FROM vw_lot_balance lb
            JOIN stock_lots l ON l.id = lb.lot_id
            JOIN chem_products p ON p.id = l.product_id
            JOIN product_actives pa ON pa.product_id = p.id
            JOIN active_substances a ON a.id = pa.active_id;
            """
        )
        conn.commit()
