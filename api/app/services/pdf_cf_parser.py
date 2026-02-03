import io
import re
from typing import List, Tuple
import pdfplumber
import requests

COORD_RE = re.compile(r"([0-9]{5,7}[\.,]?[0-9]*)")


def _to_float(value: str) -> float:
    val = value.strip().replace(" ", "")
    if val.count(",") > 0 and val.count(".") == 0:
        val = val.replace(",", ".")
    elif val.count(",") > 0 and val.count(".") > 0:
        val = val.replace(".", "").replace(",", ".")
    return float(val)


def parse_points_from_lines(lines: List[str]) -> List[Tuple[float, float]]:
    points = []
    for line in lines:
        nums = COORD_RE.findall(line)
        if len(nums) >= 2:
            try:
                x = _to_float(nums[0])
                y = _to_float(nums[1])
                if 100000 <= x <= 1000000 and 100000 <= y <= 1000000:
                    points.append((x, y))
            except ValueError:
                continue
    return points


def parse_cf_pdf(file_bytes: bytes, ocr_endpoint: str) -> List[Tuple[float, float]]:
    text_lines = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                text_lines.extend([line.strip() for line in text.splitlines() if line.strip()])

    points = parse_points_from_lines(text_lines)
    if len(points) >= 3:
        return points

    # Fallback to OCR service for scanned PDFs
    if not ocr_endpoint:
        return points

    resp = requests.post(
        f"{ocr_endpoint}/ocr",
        files={"file": ("cf.pdf", file_bytes, "application/pdf")},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    ocr_lines = [l.get("text", "") for l in data.get("lines", [])]
    points = parse_points_from_lines(ocr_lines)
    return points
