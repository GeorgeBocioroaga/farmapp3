from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, Enum, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from datetime import datetime
from db import Base

ROLE_ENUM = Enum("admin", "operator", name="role_enum")
ITEM_TYPE_ENUM = Enum("herbicide", "fertilizer", "diesel", "grain", name="item_type_enum")
MOVEMENT_ENUM = Enum("in", "out", name="movement_enum")
RASTER_SOURCE_ENUM = Enum("S2", name="raster_source_enum")
TXN_ENUM = Enum("in", "out", "adjust", name="txn_enum")
APPLICATION_STATUS_ENUM = Enum("draft", "posted", name="application_status_enum")


class CadastreCF(Base):
    __tablename__ = "cadastre_cf"

    id = Column(Integer, primary_key=True)
    cf_number = Column(String, unique=True, index=True, nullable=False)
    county = Column(String)
    locality = Column(String)
    notes = Column(Text)

    parcels = relationship("Parcel", back_populates="cf")


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True)
    cf_id = Column(Integer, ForeignKey("cadastre_cf.id"), nullable=False)
    name = Column(String, nullable=False)
    area_m2 = Column(Float)
    geom = Column(Geography("POLYGON", srid=4326))
    culture = Column(String)
    status = Column(String)

    cf = relationship("CadastreCF", back_populates="parcels")
    works = relationship("Work", back_populates="parcel", cascade="all, delete")
    crops = relationship("ParcelCrop", back_populates="parcel", cascade="all, delete")
    harvests = relationship("Harvest", back_populates="parcel", cascade="all, delete")
    soils = relationship("SoilAnalysis", back_populates="parcel", cascade="all, delete")


class ParcelCrop(Base):
    __tablename__ = "parcel_crops"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    season_year = Column(Integer, nullable=False)
    crop_id = Column(Integer, ForeignKey("crop_catalog.id"), nullable=False)
    variety_id = Column(Integer, ForeignKey("variety_catalog.id"))
    sowing_date = Column(Date)
    harvest_date = Column(Date)
    yield_t_per_ha = Column(Float)
    notes = Column(Text)

    parcel = relationship("Parcel", back_populates="crops")
    crop = relationship("CropCatalog")
    variety = relationship("VarietyCatalog")


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    type = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    depth_cm = Column(Float)
    diesel_l_per_ha = Column(Float)
    operator_id = Column(Integer)
    machine = Column(String)
    cost_total = Column(Float)
    notes = Column(Text)

    parcel = relationship("Parcel", back_populates="works")


class Chemical(Base):
    __tablename__ = "chemicals"

    id = Column(Integer, primary_key=True)
    trade_name = Column(String, nullable=False)
    active_substance = Column(String)
    concentration = Column(String)
    unit = Column(String)
    compat_notes = Column(Text)


class ActiveSubstance(Base):
    __tablename__ = "active_substances"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    name_norm = Column(String, nullable=False, unique=True, index=True)
    cas_no = Column(String)
    synonyms = Column(ARRAY(String))
    notes = Column(Text)
    aliases = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChemProduct(Base):
    __tablename__ = "chem_products"

    id = Column(Integer, primary_key=True)
    trade_name = Column(String, nullable=False)
    trade_name_norm = Column(String, nullable=False, unique=True, index=True)
    product_type = Column(String, nullable=False, default="herbicide")
    formulation = Column(String)
    supplier = Column(String)
    ean13 = Column(String)
    registration_no = Column(String)
    label_doc_id = Column(Integer, ForeignKey("docs.id"))
    sds_doc_id = Column(Integer, ForeignKey("docs.id"))
    density_kg_per_l = Column(Float)
    default_uom = Column(String)
    compat_notes = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    actives = relationship("ProductActive", back_populates="product", cascade="all, delete")


class ProductActive(Base):
    __tablename__ = "product_actives"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("chem_products.id"), nullable=False)
    active_id = Column(Integer, ForeignKey("active_substances.id"), nullable=False)
    concentration = Column(Float, nullable=False)
    unit = Column(String, nullable=False)

    product = relationship("ChemProduct", back_populates="actives")
    active = relationship("ActiveSubstance")

    __table_args__ = (
        UniqueConstraint("product_id", "active_id", name="uq_product_active"),
    )


class InventoryLocation(Base):
    __tablename__ = "inventory_locations"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True, index=True)
    location_type = Column(String)
    address = Column(String)
    notes = Column(Text)


class StockLot(Base):
    __tablename__ = "stock_lots"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("chem_products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("inventory_locations.id"), nullable=False)
    lot_code = Column(String, nullable=False, index=True)
    received_date = Column(Date, nullable=False)
    expires_at = Column(Date, nullable=True)
    uom = Column(String, nullable=False)
    unit_price = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("ChemProduct")
    location = relationship("InventoryLocation")
    txns = relationship("InventoryTxn", back_populates="lot", cascade="all, delete")

    __table_args__ = (
        Index("ix_stock_lots_product_expires", "product_id", "expires_at"),
    )


class InventoryTxn(Base):
    __tablename__ = "inventory_txns"

    id = Column(Integer, primary_key=True)
    lot_id = Column(Integer, ForeignKey("stock_lots.id"), nullable=False)
    movement = Column(TXN_ENUM, nullable=False)
    qty = Column(Float, nullable=False)
    uom = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String)
    ref_type = Column(String)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    doc_id = Column(Integer, ForeignKey("docs.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("StockLot", back_populates="txns")
    doc = relationship("Doc")


class TankMix(Base):
    __tablename__ = "tank_mixes"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    water_ph = Column(Float)
    water_hardness_ppm = Column(Float)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("TankMixItem", back_populates="mix", cascade="all, delete")


class TankMixItem(Base):
    __tablename__ = "tank_mix_items"

    id = Column(Integer, primary_key=True)
    mix_id = Column(Integer, ForeignKey("tank_mixes.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("chem_products.id"), nullable=False)
    dose_per_ha = Column(Float, nullable=False)
    uom = Column(String, nullable=False)

    mix = relationship("TankMix", back_populates="items")
    product = relationship("ChemProduct")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    date = Column(Date, nullable=False)
    mix_id = Column(Integer, ForeignKey("tank_mixes.id"))
    area_ha = Column(Float, nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"))
    machine = Column(String)
    water_l_per_ha = Column(Float)
    tank_volume_l = Column(Float)
    status = Column(APPLICATION_STATUS_ENUM, default="posted")
    total_cost = Column(Float)
    doc_id = Column(Integer, ForeignKey("docs.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("ApplicationItem", back_populates="application", cascade="all, delete")


class ApplicationItem(Base):
    __tablename__ = "application_items"

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("chem_products.id"), nullable=False)
    applied_qty = Column(Float, nullable=False)
    uom = Column(String, nullable=False)
    from_lot_id = Column(Integer, ForeignKey("stock_lots.id"))
    unit_price = Column(Float)
    cost = Column(Float)

    application = relationship("Application", back_populates="items")
    product = relationship("ChemProduct")
    lot = relationship("StockLot")


class AppLog(Base):
    __tablename__ = "app_logs"

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True)
    item_type = Column(ITEM_TYPE_ENUM, nullable=False)
    ref_id = Column(Integer)
    qty = Column(Float, default=0)
    uom = Column(String)

    movements = relationship("InventoryMovement", back_populates="inventory", cascade="all, delete")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    movement = Column(MOVEMENT_ENUM, nullable=False)
    qty = Column(Float, nullable=False)
    uom = Column(String)
    lot = Column(String)
    doc_id = Column(Integer, ForeignKey("docs.id"))
    date = Column(Date, nullable=False)

    inventory = relationship("Inventory", back_populates="movements")
    doc = relationship("Doc")


class Harvest(Base):
    __tablename__ = "harvests"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crop_catalog.id"))
    date = Column(Date, nullable=False)
    qty_t = Column(Float)
    yield_t_per_ha = Column(Float)

    parcel = relationship("Parcel", back_populates="harvests")
    tickets = relationship("HarvestTicket", back_populates="harvest", cascade="all, delete")


class HarvestTicket(Base):
    __tablename__ = "harvest_tickets"

    id = Column(Integer, primary_key=True)
    harvest_id = Column(Integer, ForeignKey("harvests.id"), nullable=False)
    silo_name = Column(String)
    qty_t = Column(Float)
    moisture_pct = Column(Float)
    test_weight = Column(Float)
    foreign_matter_pct = Column(Float)
    doc_id = Column(Integer, ForeignKey("docs.id"))

    harvest = relationship("Harvest", back_populates="tickets")
    doc = relationship("Doc")


class SoilAnalysis(Base):
    __tablename__ = "soil_analyses"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    date = Column(Date, nullable=False)
    ph = Column(Float)
    N = Column(Float)
    P = Column(Float)
    K = Column(Float)
    humus_pct = Column(Float)
    recommendations = Column(Text)
    doc_id = Column(Integer, ForeignKey("docs.id"))

    parcel = relationship("Parcel", back_populates="soils")
    doc = relationship("Doc")


class RasterAsset(Base):
    __tablename__ = "raster_assets"

    id = Column(Integer, primary_key=True)
    source = Column(RASTER_SOURCE_ENUM, nullable=False)
    captured_at = Column(DateTime)
    bbox = Column(String)
    path = Column(String)
    ndvi_path = Column(String)
    cloud_pct = Column(Float)
    tile_matrix = Column(String)


class ParcelNDVIStat(Base):
    __tablename__ = "parcel_ndvi_stats"

    id = Column(Integer, primary_key=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    captured_at = Column(DateTime, nullable=False)
    ndvi_mean = Column(Float)
    ndvi_p10 = Column(Float)
    ndvi_p90 = Column(Float)
    cloud_pct = Column(Float)
    raster_id = Column(Integer, ForeignKey("raster_assets.id"))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(ROLE_ENUM, nullable=False, default="operator")
    created_at = Column(DateTime, default=datetime.utcnow)


class Doc(Base):
    __tablename__ = "docs"

    id = Column(Integer, primary_key=True)
    path = Column(String, nullable=False)
    type = Column(String)
    ocr_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class CropCatalog(Base):
    __tablename__ = "crop_catalog"

    id = Column(Integer, primary_key=True)
    crop = Column(String, nullable=False)
    active = Column(Integer, default=1)


class VarietyCatalog(Base):
    __tablename__ = "variety_catalog"

    id = Column(Integer, primary_key=True)
    crop_id = Column(Integer, ForeignKey("crop_catalog.id"), nullable=False)
    variety = Column(String, nullable=False)
    active = Column(Integer, default=1)


class ChemMixRule(Base):
    __tablename__ = "chem_mix_rules"

    id = Column(Integer, primary_key=True)
    a_subst = Column(String, nullable=False)
    b_subst = Column(String, nullable=False)
    allowed = Column(Integer, nullable=False)
    notes = Column(Text)
