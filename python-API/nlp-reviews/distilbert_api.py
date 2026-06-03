import re
import unicodedata
import csv
import logging
from pathlib import Path

import httpx
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from transformers import pipeline

# ── Config ────────────────────────────────────────────────────────────────────
DATASET_FILE  = Path(__file__).parent / "distilbert_results.csv"
FIELDNAMES    = ["comment_id", "comment_text", "text_clean", "distilbert_label", "distilbert_score"]
MODEL_NAME    = "distilbert-base-uncased-finetuned-sst-2-english"
N8N_WEBHOOK   = "https://permalink-agriculture-actual-sink.trycloudflare.com/webhook-test/review-analysis"

classifier = pipeline("sentiment-analysis", model=MODEL_NAME)
app = FastAPI(title="DistilBERT Sentiment API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)
log = logging.getLogger("distilbert_api")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _next_id() -> int:
    if not DATASET_FILE.exists():
        return 1
    with DATASET_FILE.open(encoding="utf-8-sig") as f:
        rows = sum(1 for _ in f) - 1
    return max(rows + 1, 1)


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    text = re.sub(r"[@#]\w+", "", text)
    text = re.sub(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", "", text)
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def analyse(raw: str) -> dict:
    cleaned = clean_text(raw)
    truncated = cleaned[:512] if len(cleaned) > 512 else cleaned
    result = classifier(truncated)[0]
    label = result["label"].lower()
    score = round(result["score"], 4)
    if score < 0.65:
        label = "neutral"
    return {"text_clean": cleaned, "distilbert_label": label, "distilbert_score": score}


def append_row(row: dict) -> None:
    write_header = not DATASET_FILE.exists()
    with DATASET_FILE.open("a", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def fire_webhook(payload: dict) -> None:
    try:
        r = httpx.post(N8N_WEBHOOK, json=payload, timeout=10)
        log.info("n8n webhook → %s", r.status_code)
    except Exception as exc:
        log.warning("n8n webhook failed: %s", exc)


# ── Schema ────────────────────────────────────────────────────────────────────
class CommentIn(BaseModel):
    comment: str


class SentimentOut(BaseModel):
    comment_id:        int
    comment_text:      str
    text_clean:        str
    distilbert_label:  str
    distilbert_score:  float


# ── Web UI ────────────────────────────────────────────────────────────────────
UI = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Review Sentiment Analyser</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .card {
    background: #1a1d27;
    border: 1px solid #2d3148;
    border-radius: 16px;
    padding: 2.5rem;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 8px 40px rgba(0,0,0,.5);
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: .25rem;
    background: linear-gradient(90deg, #818cf8, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: .85rem;
    color: #64748b;
    margin-bottom: 1.75rem;
  }

  label {
    display: block;
    font-size: .8rem;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: .5rem;
  }

  textarea {
    width: 100%;
    height: 140px;
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 10px;
    color: #e2e8f0;
    font-size: .95rem;
    padding: .85rem 1rem;
    resize: vertical;
    outline: none;
    transition: border-color .2s;
  }
  textarea:focus { border-color: #818cf8; }

  button {
    margin-top: 1rem;
    width: 100%;
    padding: .8rem;
    background: linear-gradient(135deg, #6366f1, #38bdf8);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .2s;
  }
  button:disabled { opacity: .5; cursor: not-allowed; }

  /* result box */
  #result {
    margin-top: 1.75rem;
    display: none;
  }

  .badge {
    display: inline-block;
    padding: .3rem .9rem;
    border-radius: 999px;
    font-size: .85rem;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: capitalize;
  }
  .badge.positive { background: #14532d; color: #4ade80; }
  .badge.negative { background: #450a0a; color: #f87171; }
  .badge.neutral  { background: #1e293b; color: #94a3b8; }

  .score-row {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: .75rem;
  }
  .score-label { font-size: .8rem; color: #64748b; min-width: 90px; }
  .bar-track {
    flex: 1;
    height: 8px;
    background: #0f1117;
    border-radius: 999px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width .6s ease;
    background: linear-gradient(90deg, #6366f1, #38bdf8);
  }
  .score-value { font-size: .85rem; font-weight: 600; min-width: 42px; text-align: right; }

  .meta {
    margin-top: 1rem;
    font-size: .78rem;
    color: #475569;
    border-top: 1px solid #1e293b;
    padding-top: .75rem;
  }
  .meta span { color: #64748b; }

  .webhook-status {
    margin-top: .5rem;
    font-size: .75rem;
  }
  .webhook-status.sent    { color: #4ade80; }
  .webhook-status.pending { color: #fbbf24; }

  .spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid #2d3148;
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: spin .7s linear infinite;
    vertical-align: middle;
    margin-right: .4rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="card">
  <h1>Review Sentiment Analyser</h1>
  <p class="subtitle">Powered by DistilBERT &mdash; fine-tuned on SST-2</p>

  <label for="review">Paste your review</label>
  <textarea id="review" placeholder="Type or paste a review here…"></textarea>
  <button id="btn" onclick="submit()">Analyse</button>

  <div id="result">
    <div style="display:flex; align-items:center; gap:.75rem; flex-wrap:wrap;">
      <span style="font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Sentiment</span>
      <span id="badge" class="badge"></span>
    </div>

    <div class="score-row">
      <span class="score-label">Confidence</span>
      <div class="bar-track"><div id="bar" class="bar-fill" style="width:0%"></div></div>
      <span class="score-value" id="score-val"></span>
    </div>

    <div class="meta">
      ID&nbsp;<span id="meta-id"></span> &nbsp;&bull;&nbsp;
      Cleaned text: <span id="meta-clean"></span>
      <div class="webhook-status pending" id="webhook-status">&#8635; Sending to n8n workflow…</div>
    </div>
  </div>
</div>

<script>
async function submit() {
  const text = document.getElementById('review').value.trim();
  if (!text) return;

  const btn = document.getElementById('btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Analysing…';
  document.getElementById('result').style.display = 'none';
  document.getElementById('webhook-status').className = 'webhook-status pending';
  document.getElementById('webhook-status').textContent = '↻ Sending to n8n workflow…';

  try {
    const res = await fetch('/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: text })
    });
    const data = await res.json();

    const badge = document.getElementById('badge');
    badge.textContent = data.distilbert_label;
    badge.className = 'badge ' + data.distilbert_label;

    const pct = Math.round(data.distilbert_score * 100);
    document.getElementById('bar').style.width = pct + '%';
    document.getElementById('score-val').textContent = pct + '%';
    document.getElementById('meta-id').textContent = data.comment_id;
    document.getElementById('meta-clean').textContent =
      data.text_clean.length > 80 ? data.text_clean.slice(0, 80) + '…' : data.text_clean;

    document.getElementById('result').style.display = 'block';

    // webhook fires server-side; update status after short delay
    setTimeout(() => {
      document.getElementById('webhook-status').className = 'webhook-status sent';
      document.getElementById('webhook-status').textContent = '✓ n8n workflow triggered';
    }, 1200);

  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyse';
  }
}

document.getElementById('review').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') submit();
});
</script>
</body>
</html>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def ui():
    return UI


@app.post("/analyse", response_model=SentimentOut, summary="Analyse a comment with DistilBERT")
def analyse_comment(body: CommentIn, background_tasks: BackgroundTasks) -> SentimentOut:
    result = analyse(body.comment)

    comment_id = _next_id()
    row = {
        "comment_id":       comment_id,
        "comment_text":     body.comment,
        "text_clean":       result["text_clean"],
        "distilbert_label": result["distilbert_label"],
        "distilbert_score": result["distilbert_score"],
    }
    append_row(row)

    background_tasks.add_task(fire_webhook, row)

    return SentimentOut(**row)


@app.get("/health", summary="Health check")
def health():
    return {"status": "ok", "model": MODEL_NAME}
