from sqlalchemy.orm import Session
from db import SessionLocal
from models import User, CropCatalog, VarietyCatalog, ActiveSubstance, ChemProduct, ProductActive
from services import chem_parse
from security import get_password_hash

CROPS = [
    "grâu",
    "porumb",
    "floarea-soarelui",
    "rapiță",
    "orz",
    "orzoaică",
    "soia",
    "triticale",
    "mazăre",
    "lucernă",
]

VARIETIES = {
    "grâu": ["Glosa", "Izvor"],
    "porumb": ["P9903", "P9415"],
    "floarea-soarelui": ["Neoma"],
}

FERTILIZER_PRESETS = {
    "NPK 15-15-15": [
        ("N", 15.0, "%w/w"),
        ("P2O5", 15.0, "%w/w"),
        ("K2O", 15.0, "%w/w"),
    ]
}


def seed_all():
    db: Session = SessionLocal()
    try:
        admin = db.query(User).filter(User.name == "admin").first()
        if not admin:
            admin = User(name="admin", hashed_password=get_password_hash("admin"), role="admin")
            db.add(admin)

        existing_crops = {c.crop for c in db.query(CropCatalog).all()}
        for crop in CROPS:
            if crop not in existing_crops:
                db.add(CropCatalog(crop=crop, active=1))

        db.flush()
        crop_map = {c.crop: c.id for c in db.query(CropCatalog).all()}
        for crop, vars_list in VARIETIES.items():
            crop_id = crop_map.get(crop)
            if not crop_id:
                continue
            existing_vars = {v.variety for v in db.query(VarietyCatalog).filter(VarietyCatalog.crop_id == crop_id).all()}
            for v in vars_list:
                if v not in existing_vars:
                    db.add(VarietyCatalog(crop_id=crop_id, variety=v, active=1))

        # Fertilizer presets
        existing_actives = {a.name_norm: a for a in db.query(ActiveSubstance).all()}
        for product_name, actives in FERTILIZER_PRESETS.items():
            trade_norm = chem_parse.normalize_text(product_name).replace(" ", "")
            product = db.query(ChemProduct).filter(ChemProduct.trade_name_norm == trade_norm).first()
            if not product:
                product = ChemProduct(
                    trade_name=product_name,
                    trade_name_norm=trade_norm,
                    default_uom="kg",
                    product_type="fertilizer",
                )
            db.add(product)
            db.flush()
            if product.product_type != "fertilizer":
                product.product_type = "fertilizer"
            for active_name, conc, unit in actives:
                name_norm = chem_parse.normalize_text(active_name).replace(" ", "")
                active = existing_actives.get(name_norm)
                if not active:
                    active = ActiveSubstance(name=active_name, name_norm=name_norm)
                    db.add(active)
                    db.flush()
                    existing_actives[name_norm] = active
                existing_pa = (
                    db.query(ProductActive)
                    .filter(ProductActive.product_id == product.id, ProductActive.active_id == active.id)
                    .first()
                )
                if not existing_pa:
                    db.add(ProductActive(product_id=product.id, active_id=active.id, concentration=conc, unit=unit))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
    print("Seed completed")
