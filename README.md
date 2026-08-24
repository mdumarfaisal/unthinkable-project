# Signalroom

Signalroom is a focused full-stack app for the Social Media Content Analyzer assessment. It gives creators a calm upload-to-insight workflow: drag in a PDF or image, run real text extraction or OCR, review the extracted text, and apply engagement recommendations.

## Approach

The Flask API receives files in memory, uses `pypdf` to preserve page-separated PDF text, and uses Pillow plus Tesseract for scanned images. A small deterministic scoring layer evaluates the extracted post for hook, clarity, and call-to-action signals, then returns recommendations to the browser. Files are never written to disk. The responsive frontend shares validation, loading, completion, and error states, supports keyboard activation for the drop area, renders API recommendations into the insight cards, and previews uploaded images beside their OCR text.

## Run locally

Create the environment and install dependencies:

```powershell
python -m venv .venv
.venv\\Scripts\\python.exe -m pip install -r requirements.txt
```

Install the native Tesseract executable and add it to `PATH`, then start the single application server:

```powershell
.venv\\Scripts\\python.exe backend.py
```

Open http://127.0.0.1:5000. The backend automatically detects the standard Windows Tesseract install path. PDF extraction works with the Python dependencies alone.

Run the backend tests:

```powershell
.venv\\Scripts\\python.exe -m unittest discover -s tests -v
```

## Deploy

Deploy this repository to Render using the included `render.yaml` and `Dockerfile`. The Docker image installs Tesseract automatically, and Render uses `/health` to check service availability. For another Python host, the included `Procfile` starts `gunicorn backend:app`; install Tesseract on the host image for image OCR support.

## Supported files

- PDF
- PNG, JPG, and WEBP images
- Maximum size: 10 MB
