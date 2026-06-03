# DistilBERT Sentiment Analysis API

FastAPI service that uses a fine-tuned DistilBERT model (`distilbert-base-uncased-finetuned-sst-2-english`) for sentiment analysis. No local training required — the model is downloaded from HuggingFace Hub on first run.

## Requirements

- Python 3.9+
- pip

## Installation

```bash
pip install fastapi uvicorn transformers torch pydantic httpx
```

## Running the API

```bash
uvicorn distilbert_api:app --reload
```

The server starts at `http://127.0.0.1:8000`.

> **Note:** The first run downloads the DistilBERT model (~260 MB) and caches it locally. Subsequent runs are instant.

## Web UI

Open `http://127.0.0.1:8000` in your browser. Paste any review text and click **Analyse** (or press `Ctrl+Enter`) to see the sentiment label and confidence score. The n8n workflow is triggered automatically in the background on each submission.

## Endpoints

### `GET /`

Serves the web UI.

---

### `POST /analyse`

Analyse the sentiment of a comment.

**Request body:**
```json
{ "comment": "This product is absolutely amazing!" }
```

**Response:**
```json
{
  "comment_id": 1,
  "comment_text": "This product is absolutely amazing!",
  "text_clean": "this product is absolutely amazing",
  "distilbert_label": "positive",
  "distilbert_score": 0.9998
}
```

Labels: `positive`, `negative`, `neutral` (confidence < 0.65 maps to neutral).

Every call also fires a POST to the n8n webhook in the background:
```
https://permalink-agriculture-actual-sink.trycloudflare.com/webhook-test/review-analysis
```

---

### `GET /health`

```json
{ "status": "ok", "model": "distilbert-base-uncased-finetuned-sst-2-english" }
```

## Interactive Docs

Once running, open `http://127.0.0.1:8000/docs` for the Swagger UI.

## Output

Results are appended to `distilbert_results.csv` automatically on each request.
