from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
import os
import tempfile
from pathlib import Path

lang = os.getenv("OCR_LANG", "ro")
ocr = PaddleOCR(use_angle_cls=True, lang=lang)
app = FastAPI(title="OCR Service")


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)):
    content = await file.read()
    suffix = Path(file.filename or "").suffix
    if not suffix:
        ct = (file.content_type or "").lower()
        if "jpeg" in ct or "jpg" in ct:
            suffix = ".jpg"
        elif "png" in ct:
            suffix = ".png"
        elif "pdf" in ct:
            suffix = ".pdf"
        else:
            suffix = ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = ocr.ocr(tmp_path, cls=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OCR failed: {exc}")
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    lines = []
    for page in result:
        for line in page:
            text = line[1][0]
            conf = float(line[1][1])
            lines.append({"text": text, "conf": conf})
    return {"lines": lines}
