from sqlalchemy.engine import Engine


def ensure_schema_extensions(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS product_type VARCHAR")
        conn.exec_driver_sql("UPDATE chem_products SET product_type = 'herbicide' WHERE product_type IS NULL")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_chem_products_type ON chem_products (product_type)")
        conn.exec_driver_sql("ALTER TABLE active_substances ADD COLUMN IF NOT EXISTS cas_no VARCHAR")
        conn.exec_driver_sql("ALTER TABLE active_substances ADD COLUMN IF NOT EXISTS synonyms TEXT[]")
        conn.exec_driver_sql("ALTER TABLE active_substances ADD COLUMN IF NOT EXISTS notes TEXT")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS formulation VARCHAR")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS supplier VARCHAR")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS ean13 VARCHAR")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS registration_no VARCHAR")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS label_doc_id INTEGER")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS sds_doc_id INTEGER")
        conn.exec_driver_sql("ALTER TABLE chem_products ADD COLUMN IF NOT EXISTS compat_notes TEXT")
        conn.exec_driver_sql("ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS unit_price NUMERIC")
        conn.exec_driver_sql("ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS manufacture_date DATE")
        conn.exec_driver_sql("ALTER TABLE stock_lots ALTER COLUMN expires_at DROP NOT NULL")
        conn.exec_driver_sql("ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS reason VARCHAR")
        conn.exec_driver_sql("ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS ref_id INTEGER")
        conn.exec_driver_sql("ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP")
        conn.exec_driver_sql("ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS created_by INTEGER")
        conn.exec_driver_sql("ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS ref_type VARCHAR")
        conn.exec_driver_sql("UPDATE inventory_txns SET created_at = COALESCE(created_at, NOW())")
        conn.exec_driver_sql(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_stock_lot_unique'
              ) THEN
                ALTER TABLE stock_lots ADD CONSTRAINT uq_stock_lot_unique
                UNIQUE (product_id, lot_code, expires_at, location_id);
              END IF;
            END $$;
            """
        )
        conn.commit()
