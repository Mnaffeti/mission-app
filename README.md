# AirEsprit

React web app with passport scanning, review sentiment analysis, and a Power BI admin dashboard.

---

## Running everything

Open **3 terminals** and run each in order.

### 1 — Passport API (Flask · port 5000)

```bash
cd python-API/passport-detection

# create & activate venv (first time only)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux

pip install flask flask-cors ultralytics easyocr gradio pillow numpy
python app.py
```

> First run downloads YOLO weights — takes a few minutes.
> Health check: `http://localhost:5000/health`

### 2 — Sentiment API (FastAPI · port 8000)

```bash
cd python-API/nlp-reviews

# create & activate venv (first time only)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux

pip install -r requirements.txt
uvicorn distilbert_api:app --host 0.0.0.0 --port 8000 --reload
```

> First run downloads DistilBERT (~260 MB) and takes 30–60 s to be ready.
> Health check: `http://localhost:8000/health`

### 3 — Web UI (Vite · port 5173)

```bash
npm install        # first time only
npm run dev
```

Open `http://localhost:5173`.

---

## Roles

| Role | Route | Features |
|------|-------|---------|
| User | `/user` | Passport Scanner, Review Analyzer |
| Admin | `/admin` | Power BI Dashboard |

Login accepts any non-empty credentials (client-side only).
