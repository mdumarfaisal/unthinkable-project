from __future__ import annotations

import io
import os
import re
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from PIL import Image
from pypdf import PdfReader
import pytesseract

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff"}

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

for tesseract_path in (
    os.getenv("TESSERACT_CMD"),
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
):
    if tesseract_path and Path(tesseract_path).is_file():
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        break


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


def extract_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(f"[Page {page_number}]\n{text.strip()}")
    return "\n\n".join(pages)


def extract_image(data: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(data))
        return pytesseract.image_to_string(image).strip()
    except pytesseract.TesseractNotFoundError as error:
        raise RuntimeError("OCR is not available. Install the Tesseract executable and add it to PATH.") from error


def score_text(text: str) -> dict:
    words = re.findall(r"\b\w+\b", text)
    word_count = len(words)
    hashtag_count = len(re.findall(r"#[A-Za-z0-9_]+", text))
    first_sentence = re.split(r"[.!?\n]", text.strip())[0] if text.strip() else ""
    has_question = "?" in text
    has_action = bool(re.search(r"\b(try|start|join|download|share|tell|comment|learn|visit|sign|book|buy)\b", text, re.I))
    hook = min(98, max(35, 62 + (15 if len(first_sentence) <= 12 else 4) + (10 if has_question else 0)))
    clarity = min(97, max(35, 92 - max(0, word_count - 80) // 4))
    cta = min(96, 82 if has_action else 58)
    overall = round(hook * 0.4 + clarity * 0.35 + cta * 0.25)
    recommendations = []
    if not has_action:
        recommendations.append({"title": "Make the next step specific", "body": "Close with one clear action so readers know how to respond or continue.", "label": "QUICK WIN"})
    if word_count > 80:
        recommendations.append({"title": "Lead with the reader's payoff", "body": "Put the clearest benefit first so the value lands before the supporting detail.", "label": "MORE CLARITY"})
    if not has_question:
        recommendations.append({"title": "Try a conversation starter", "body": "Invite a point of view with a focused question to create a natural reply.", "label": "EXPERIMENT"})
    return {
        "score": overall,
        "metrics": {"hook": hook, "clarity": clarity, "cta": cta},
        "summary": {"words": word_count, "reading_seconds": max(1, round(word_count / 3.3)), "hashtags": hashtag_count},
        "recommendations": recommendations[:3],
    }


@app.post("/analyze")
def analyze():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"error": "Choose a PDF or image file to analyze."}), 400
    data = upload.read()
    if len(data) > MAX_FILE_SIZE:
        return jsonify({"error": "That file is over the 10 MB limit."}), 413

    filename = Path(upload.filename).name
    is_pdf = upload.mimetype == "application/pdf" or filename.lower().endswith(".pdf")
    if not is_pdf and upload.mimetype not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only PDF, PNG, JPG, WEBP, GIF, BMP, and TIFF files are supported."}), 415

    try:
        text = extract_pdf(data) if is_pdf else extract_image(data)
    except Exception as error:
        return jsonify({"error": str(error)}), 422
    if not text.strip():
        return jsonify({"error": "No readable text was found in that file."}), 422

    result = score_text(text)
    result.update({"filename": filename, "kind": "PDF" if is_pdf else "IMG", "text": text})
    return jsonify(result)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
