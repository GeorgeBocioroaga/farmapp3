from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserOut(BaseModel):
    id: int
    name: str
    role: str

    class Config:
        orm_mode = True


class CFCreate(BaseModel):
    cf_number: str
    county: Optional[str] = None
    locality: Optional[str] = None
    notes: Optional[str] = None


class CFOut(BaseModel):
    id: int
    cf_number: str
    county: Optional[str]
    locality: Optional[str]
    notes: Optional[str]

    class Config:
        orm_mode = True


class ParcelBase(BaseModel):
    cf_id: Optional[int] = None
    cf_number: Optional[str] = None
    name: str
    area_m2: Optional[float] = None
    culture: Optional[str] = None
    status: Optional[str] = None


class ParcelCreate(ParcelBase):
    geom_geojson: dict


class ParcelUpdate(BaseModel):
    name: Optional[str] = None
    culture: Optional[str] = None
    status: Optional[str] = None
    geom_geojson: Optional[dict] = None


class ParcelOut(BaseModel):
    id: int
    cf_id: int
    name: str
    area_m2: Optional[float]
    culture: Optional[str]
    status: Optional[str]
    geom_geojson: Optional[dict] = None
    cf_number: Optional[str] = None

    class Config:
        orm_mode = True


class WorkCreate(BaseModel):
    type: str
    date: date
    depth_cm: Optional[float] = None
    diesel_l_per_ha: Optional[float] = None
    operator_id: Optional[int] = None
    machine: Optional[str] = None
    cost_total: Optional[float] = None
    notes: Optional[str] = None


class WorkUpdate(BaseModel):
    type: Optional[str] = None
    date: Optional[date] = None
    depth_cm: Optional[float] = None
    diesel_l_per_ha: Optional[float] = None
    operator_id: Optional[int] = None
    machine: Optional[str] = None
    cost_total: Optional[float] = None
    notes: Optional[str] = None


class WorkOut(WorkCreate):
    id: int
    parcel_id: int

    class Config:
        orm_mode = True


class ChemicalCreate(BaseModel):
    trade_name: str
    active_substance: Optional[str] = None
    concentration: Optional[str] = None
    unit: Optional[str] = None
    compat_notes: Optional[str] = None


class ChemicalOut(ChemicalCreate):
    id: int

    class Config:
        orm_mode = True


class InventoryCreate(BaseModel):
    item_type: str
    ref_id: Optional[int] = None
    qty: Optional[float] = 0
    uom: Optional[str] = None


class InventoryUpdate(BaseModel):
    qty: Optional[float] = None
    uom: Optional[str] = None


class InventoryOut(InventoryCreate):
    id: int

    class Config:
        orm_mode = True


class InventoryMovementCreate(BaseModel):
    inventory_id: int
    movement: str
    qty: float
    uom: Optional[str] = None
    lot: Optional[str] = None
    doc_id: Optional[int] = None
    date: date


class InventoryMovementOut(InventoryMovementCreate):
    id: int

    class Config:
        orm_mode = True


class ActiveSubstanceCreate(BaseModel):
    name: str
    cas_no: Optional[str] = None
    synonyms: Optional[List[str]] = None
    notes: Optional[str] = None


class ActiveSubstanceOut(ActiveSubstanceCreate):
    id: int

    class Config:
        orm_mode = True


class ProductActiveIn(BaseModel):
    active_id: Optional[int] = None
    active_name: Optional[str] = None
    concentration: float
    unit: str


class ChemProductUpsert(BaseModel):
    trade_name: str
    product_type: Optional[str] = None
    supplier: Optional[str] = None
    ean13: Optional[str] = None
    registration_no: Optional[str] = None
    formulation: Optional[str] = None
    density_kg_per_l: Optional[float] = None
    default_uom: Optional[str] = None
    label_doc_id: Optional[int] = None
    sds_doc_id: Optional[int] = None
    compat_notes: Optional[str] = None
    notes: Optional[str] = None
    actives: List[ProductActiveIn] = Field(default_factory=list)


class ChemProductOut(ChemProductUpsert):
    id: int

    class Config:
        orm_mode = True


class InventoryLotCreate(BaseModel):
    product_id: int
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    lot_code: str
    received_date: date
    expires_at: Optional[date] = None
    expiry_date: Optional[date] = None
    qty: float
    uom: str
    unit_price: Optional[float] = None
    notes: Optional[str] = None


class InventoryLotOut(BaseModel):
    id: int
    product_id: int
    location_id: int
    lot_code: str
    received_date: date
    expires_at: Optional[date] = None
    uom: str
    unit_price: Optional[float] = None
    notes: Optional[str] = None
    qty: Optional[float] = None
    expires_in_days: Optional[int] = None
    expiring_soon: Optional[bool] = None

    class Config:
        orm_mode = True


class InventoryTxnCreate(BaseModel):
    movement: str
    lot_id: Optional[int] = None
    product_id: Optional[int] = None
    qty: float
    uom: str
    date: date
    doc_id: Optional[int] = None
    reason: Optional[str] = None
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
    created_by: Optional[int] = None
    notes: Optional[str] = None


class InventoryTxnOut(InventoryTxnCreate):
    id: int
    lot_id: int

    class Config:
        orm_mode = True


class ActiveStockBreakdown(BaseModel):
    product_id: int
    trade_name: str
    lot_id: int
    lot_code: Optional[str] = None
    qty: Optional[float] = None
    uom: Optional[str] = None
    active_kg: Optional[float] = None
    expires_at: Optional[date] = None


class ActiveStockResponse(BaseModel):
    active_name: str
    total_kg: float
    breakdown: List[ActiveStockBreakdown]


class MixItemIn(BaseModel):
    product_id: int
    dose_per_ha: float
    uom: str


class MixCreate(BaseModel):
    name: Optional[str] = None
    items: List[MixItemIn]
    water_ph: Optional[float] = None
    water_hardness_ppm: Optional[float] = None
    notes: Optional[str] = None


class MixOut(BaseModel):
    id: int
    name: Optional[str] = None
    items: List[MixItemIn]
    water_ph: Optional[float] = None
    water_hardness_ppm: Optional[float] = None
    notes: Optional[str] = None

    class Config:
        orm_mode = True


class ApplicationItemIn(BaseModel):
    product_id: int
    dose_per_ha: float
    uom: str


class ApplicationCreate(BaseModel):
    parcel_id: int
    date: date
    area_ha: float
    items: Optional[List[ApplicationItemIn]] = None
    mix_id: Optional[int] = None
    water_l_per_ha: Optional[float] = None
    tank_volume_l: Optional[float] = None
    operator_id: Optional[int] = None
    machine: Optional[str] = None
    status: Optional[str] = "posted"


class ApplicationOut(BaseModel):
    id: int
    parcel_id: int
    date: date
    area_ha: float
    total_cost: Optional[float] = None
    status: Optional[str] = None

    class Config:
        orm_mode = True


class HarvestCreate(BaseModel):
    parcel_id: int
    crop_id: Optional[int] = None
    date: date
    qty_t: Optional[float] = None
    yield_t_per_ha: Optional[float] = None


class HarvestOut(HarvestCreate):
    id: int

    class Config:
        orm_mode = True


class HarvestTicketCreate(BaseModel):
    silo_name: Optional[str] = None
    qty_t: Optional[float] = None
    moisture_pct: Optional[float] = None
    test_weight: Optional[float] = None
    foreign_matter_pct: Optional[float] = None
    doc_id: Optional[int] = None


class HarvestTicketOut(HarvestTicketCreate):
    id: int
    harvest_id: int

    class Config:
        orm_mode = True


class SoilAnalysisCreate(BaseModel):
    parcel_id: int
    date: date
    ph: Optional[float] = None
    N: Optional[float] = None
    P: Optional[float] = None
    K: Optional[float] = None
    humus_pct: Optional[float] = None
    recommendations: Optional[str] = None
    doc_id: Optional[int] = None


class SoilAnalysisOut(SoilAnalysisCreate):
    id: int

    class Config:
        orm_mode = True


class CropCreate(BaseModel):
    crop: str
    active: Optional[int] = 1


class CropOut(CropCreate):
    id: int

    class Config:
        orm_mode = True


class VarietyCreate(BaseModel):
    crop_id: int
    variety: str
    active: Optional[int] = 1


class VarietyOut(VarietyCreate):
    id: int

    class Config:
        orm_mode = True


class ParcelCropCreate(BaseModel):
    season_year: int
    crop_id: int
    variety_id: Optional[int] = None
    sowing_date: Optional[date] = None
    harvest_date: Optional[date] = None
    yield_t_per_ha: Optional[float] = None
    notes: Optional[str] = None


class ParcelCropOut(ParcelCropCreate):
    id: int
    parcel_id: int

    class Config:
        orm_mode = True


class RasterIngest(BaseModel):
    source: str = "S2"
    captured_at: Optional[datetime] = None
    bbox: Optional[str] = None
    path: Optional[str] = None
    ndvi_path: Optional[str] = None
    cloud_pct: Optional[float] = None
    tile_matrix: Optional[str] = None


class RasterOut(RasterIngest):
    id: int

    class Config:
        orm_mode = True


class MixCheckRequest(BaseModel):
    a_subst: str
    b_subst: str


class MixCheckResponse(BaseModel):
    status: str
    notes: Optional[str] = None


class OCRLine(BaseModel):
    text: str
    conf: float


class OCRResult(BaseModel):
    lines: List[OCRLine]


class LabelParseResult(BaseModel):
    trade_name: Optional[str] = None
    actives: List[dict] = Field(default_factory=list)
    raw_lines: List[str] = Field(default_factory=list)


class TicketParseResult(BaseModel):
    values: dict
    raw_lines: List[str] = Field(default_factory=list)
