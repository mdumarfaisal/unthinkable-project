import io
import unittest
from unittest.mock import patch

from backend import app, score_text


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        cls.client = app.test_client()

    def test_missing_file_is_rejected(self):
        response = self.client.post("/analyze")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Choose a PDF", response.json["error"])

    def test_unsupported_file_is_rejected(self):
        response = self.client.post(
            "/analyze",
            data={"file": (io.BytesIO(b"text"), "notes.txt")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 415)

    @patch("backend.extract_pdf", return_value="Launch day is here. Tell us what you think?")
    def test_pdf_response_contains_extracted_text_and_scores(self, extract_pdf):
        response = self.client.post(
            "/analyze",
            data={"file": (io.BytesIO(b"pdf bytes"), "launch.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["kind"], "PDF")
        self.assertEqual(response.json["text"], "Launch day is here. Tell us what you think?")
        self.assertIn("metrics", response.json)
        extract_pdf.assert_called_once()

    @patch("backend.extract_image", return_value="Try our new product and share your thoughts.")
    def test_image_response_uses_ocr_text(self, extract_image):
        response = self.client.post(
            "/analyze",
            data={"file": (io.BytesIO(b"image bytes"), "campaign.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["kind"], "IMG")
        self.assertEqual(response.json["text"], "Try our new product and share your thoughts.")
        extract_image.assert_called_once()

    def test_score_recommends_a_clear_cta(self):
        result = score_text("A thoughtful product update without a direct ask.")
        self.assertLess(result["metrics"]["cta"], 70)
        self.assertTrue(result["recommendations"])

    @patch("backend.extract_pdf", return_value="[Page 1]\nFirst page\n\n[Page 2]\nSecond page")
    def test_pdf_result_keeps_page_labels(self, extract_pdf):
        response = self.client.post(
            "/analyze",
            data={"file": (io.BytesIO(b"pdf bytes"), "multi-page.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("[Page 1]", response.json["text"])
        self.assertIn("[Page 2]", response.json["text"])


if __name__ == "__main__":
    unittest.main()
