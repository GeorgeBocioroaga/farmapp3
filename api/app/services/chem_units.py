from typing import Optional
from services import chem_parse

ALLOWED_CONC_UNITS = {"g/L", "g/kg", "%w/w", "%w/v"}
ALLOWED_UOM = {"l", "kg"}


def normalize_uom(uom: str) -> str:
    if not uom:
        return ""
    raw = chem_parse.normalize_text(uom)
    raw = raw.replace(" ", "")
    if raw in {"l", "lt", "litru", "litri", "liters", "liter"}:
        return "l"
    if raw in {"kg", "kilogram", "kilograme"}:
        return "kg"
    return raw


def normalize_conc_unit(unit: str) -> Optional[str]:
    return chem_parse.normalize_unit(unit)


def validate_concentration(value: float, unit: str) -> Optional[str]:
    if value is None:
        return "Concentratia este obligatorie."
    if value <= 0:
        return "Concentratia trebuie sa fie > 0."
    if unit in {"%w/w", "%w/v"} and value > 100:
        return "Concentratia procentuala nu poate depasi 100%."
    if unit in {"g/L", "g/kg"} and value > 5000:
        return "Concentratia pare prea mare (peste 5000 g/L sau g/kg)."
    return None


def requires_density(conc_unit: str, lot_uom: str) -> bool:
    if conc_unit in {"g/kg", "%w/w"} and lot_uom == "l":
        return True
    if conc_unit in {"g/L", "%w/v"} and lot_uom == "kg":
        return True
    return False


def active_kg_from_qty(qty: float, lot_uom: str, conc: float, conc_unit: str, density_kg_per_l: Optional[float]) -> Optional[float]:
    if qty is None or conc is None:
        return None
    if lot_uom == "l":
        if conc_unit == "g/L":
            return qty * conc / 1000
        if conc_unit == "%w/v":
            return qty * conc / 100
        if conc_unit in {"g/kg", "%w/w"}:
            if not density_kg_per_l:
                return None
            kg_product = qty * density_kg_per_l
            return kg_product * (conc / 1000 if conc_unit == "g/kg" else conc / 100)
    if lot_uom == "kg":
        if conc_unit == "g/kg":
            return qty * conc / 1000
        if conc_unit == "%w/w":
            return qty * conc / 100
        if conc_unit in {"g/L", "%w/v"}:
            if not density_kg_per_l:
                return None
            liters = qty / density_kg_per_l
            return liters * (conc / 1000 if conc_unit == "g/L" else conc / 100)
    return None
