# Signalroom

Signalroom is a focused frontend prototype for the Social Media Content Analyzer assessment. It gives creators a calm upload-to-insight workflow: drag in a PDF or image, see validation and extraction progress, review the extracted text, and apply engagement recommendations.

## Approach

The interface is built as a dependency-free static app so it can be run immediately in a browser. PDF uploads simulate text extraction and image uploads simulate OCR, with both paths sharing validation, loading, completion, and recent-analysis states. The analysis panel presents a simple score model across hook, clarity, and CTA, while recommendations can be applied or saved. In production, `analyzeFile` in `app.js` is the integration point for a PDF parser and OCR service; the current UI contract keeps that backend swap small. The layout is responsive, keyboard-accessible for the drop area, and includes basic size/type errors plus private-file messaging.

## Run locally

Python 3 is the only prerequisite:

```powershell
python -m http.server 4173
```

Open http://localhost:4173.

## Supported files

- PDF
- PNG, JPG, and WEBP images
- Maximum size: 10 MB
