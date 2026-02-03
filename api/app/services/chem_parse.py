import re
import unicodedata
from typing import List, Dict, Optional

ACTIVE_HINTS = [
    "glifosat",
    "glifosat acid",
    "glyphosate",
    "glyphosate acid",
    "2,4-d",
    "2,4 d",
    "dicamba",
    "metribuzin",
    "tribenuron",
    "fluazifop",
    "clomazone",
    "propiconazol",
    "tebuconazol",
    "azoxistrobin",
]

ACTIVE_SYNONYMS = {
    "glifosat": "glifosat acid",
    "glifosat acid": "glifosat acid",
    "glyphosate": "glifosat acid",
    "glyphosate acid": "glifosat acid",
    "2,4-d": "2,4-d",
    "2 4 d": "2,4-d",
}

TRADE_SKIP_HINTS = [
    "substanta activa",
    "ingredient activ",
    "formulare",
    "producator",
    "importator",
    "detinator",
    "omolog",
    "lot",
    "valabilitate",
    "utilizare",
    "atentie",
    "erbicid",
]

UNIT_MAP = {
    "g/l": "g/L",
    "g\\l": "g/L",
    "gkg": "g/kg",
    "g/kg": "g/kg",
    "g per l": "g/L",
    "g per kg": "g/kg",
    "%w/w": "%w/w",
    "% w/w": "%w/w",
    "%w/v": "%w/v",
    "% w/v": "%w/v",
    "%": "%w/w",
}

CONC_RE = re.compile(
    r"(?P<val>[0-9]+(?:[\.,][0-9]+)?)\s*(?P<unit>g\s*[/\\]\s*l|g\s*[/\\]\s*kg|%\\s*w/w|%\\s*w/v|%|g\\s*per\\s*l|g\\s*per\\s*kg)",
    re.IGNORECASE,
)
EAN_RE = re.compile(r"\b\d{13}\b")


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9%/\\,.\\s-]", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text


def normalize_active_name(name: str) -> str:
    cleaned = normalize_text(name)
    cleaned = cleaned.replace(",", " ")
    cleaned = re.sub(r"\\s+", " ", cleaned).strip()
    return ACTIVE_SYNONYMS.get(cleaned, cleaned)


def normalize_unit(unit: str) -> Optional[str]:
    if not unit:
        return None
    cleaned = normalize_text(unit)
    cleaned = cleaned.replace(" ", "")
    cleaned = cleaned.replace("\\", "/")
    cleaned = cleaned.replace("g/kg", "g/kg")
    cleaned = cleaned.replace("g/l", "g/l")
    cleaned = cleaned.replace("%w/w", "%w/w").replace("%w/v", "%w/v")
    return UNIT_MAP.get(cleaned, UNIT_MAP.get(cleaned.replace("/", "/"), None))


def parse_label_lines(lines: List[str]) -> Dict:
    actives = []
    trade_name = None
    ean13 = None
    trade_name = _pick_trade_name(lines)
    for line in lines:
        if not ean13:
            m = EAN_RE.search(line)
            if m:
                ean13 = m.group(0)
        low = normalize_text(line)
        for hint in ACTIVE_HINTS:
            if normalize_text(hint) in low:
                conc_match = CONC_RE.search(line)
                conc = None
                unit = None
                if conc_match:
                    conc = float(conc_match.group("val").replace(",", "."))
                    unit = normalize_unit(conc_match.group("unit"))
                actives.append({"name": hint, "concentration": conc, "unit": unit})
    return {"trade_name": trade_name, "actives": _dedupe_actives(actives), "ean13": ean13, "raw_lines": lines}


def parse_ticket_lines(lines: List[str]) -> Dict:
    values = {}
    for line in lines:
        low = line.lower()
        if "umid" in low:
            values["moisture_pct"] = _extract_number(line)
        if "mh" in low or "masa hectolitric" in low:
            values["test_weight"] = _extract_number(line)
        if "corp" in low:
            values["foreign_matter_pct"] = _extract_number(line)
        if "cantitate" in low or "kg" in low or "tone" in low:
            if "qty_t" not in values:
                values["qty_t"] = _extract_number(line)
    return {"values": values, "raw_lines": lines}


def _extract_number(line: str):
    m = re.search(r"([0-9]+(?:[\.,][0-9]+)?)", line)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def map_actives_to_canonical(actives: List[Dict]) -> List[Dict]:
    mapped = []
    for item in actives:
        name = item.get("name") or ""
        mapped.append(
            {
                "name": normalize_active_name(name),
                "concentration": item.get("concentration"),
                "unit": normalize_unit(item.get("unit")),
            }
        )
    return _dedupe_actives(mapped)


def _pick_trade_name(lines: List[str]) -> Optional[str]:
    best = None
    best_score = -1.0
    for i, raw in enumerate(lines):
        line = raw.strip()
        if len(line) < 3:
            continue
        if CONC_RE.search(line):
            continue

        cleaned = re.sub(r"\\bERBICID\\b", "", line, flags=re.IGNORECASE)
        cleaned = re.sub(r"\\s{2,}", " ", cleaned).strip(" -–—")
        norm_clean = normalize_text(cleaned)

        if any(h in norm_clean for h in TRADE_SKIP_HINTS if h != "erbicid"):
            continue

        if i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if re.fullmatch(r"\\d{2,4}", next_line):
                cleaned = f"{cleaned} {next_line}".strip()

        if len(cleaned) < 3:
            continue

        alpha = [c for c in cleaned if c.isalpha()]
        if not alpha:
            continue
        upper = [c for c in alpha if c.isupper()]
        ratio = len(upper) / max(len(alpha), 1)
        has_hyphen = "-" in cleaned
        length_score = 1.0 - min(abs(len(cleaned) - 12), 12) / 12.0
        score = ratio * 2.0 + (1.0 if has_hyphen else 0.0) + length_score

        if score > best_score:
            best_score = score
            best = cleaned
    if best:
        return best
    for raw in lines:
        line = raw.strip()
        if len(line) >= 3:
            return line
    return None


def _dedupe_actives(actives: List[Dict]) -> List[Dict]:
    seen = set()
    result = []
    for a in actives:
        name = normalize_active_name(a.get("name") or "")
        conc = a.get("concentration")
        unit = normalize_unit(a.get("unit"))
        key = (name, conc, unit)
        if key in seen:
            continue
        seen.add(key)
        result.append({"name": name, "concentration": conc, "unit": unit})
    return result
