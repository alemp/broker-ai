from __future__ import annotations

from fastapi import FastAPI, File, Form, UploadFile
from pdf2image import convert_from_bytes
import pytesseract

app = FastAPI(title="ai-copilot-ocr", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/ocr")
async def ocr_pdf(
    file: UploadFile = File(...),
    language: str = Form(default="por"),
    max_pages: int = Form(default=10),
    dpi: int = Form(default=150),
) -> dict[str, object]:
    pdf_bytes = await file.read()
    images = convert_from_bytes(pdf_bytes, dpi=dpi)
    images = images[: max(1, max_pages)]
    parts: list[str] = []
    for img in images:
        parts.append(pytesseract.image_to_string(img, lang=language) or "")
    text = "\n".join(p for p in parts if p.strip())
    return {"text": text, "pages": len(images), "language": language, "dpi": dpi, "max_pages": max_pages}

