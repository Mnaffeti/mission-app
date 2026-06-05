import { useState } from 'react'

const MAX_CHARS = 1000
const API_URL   = 'http://localhost:8000/analyse'

const SENT = {
  positive: { emoji: '😊', color: '#34c759', label: 'Great experience!',  bg: 'rgba(52,199,89,.08)'  },
  negative: { emoji: '😞', color: '#ff453a', label: 'We hear you',        bg: 'rgba(255,69,58,.08)'  },
  neutral:  { emoji: '😐', color: '#ff9f0a', label: 'Thanks for sharing', bg: 'rgba(255,159,10,.08)' },
}

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

async function callSentimentAPI(text) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: text }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export default function ReviewAnalyzer() {
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [apiError, setApiError] = useState(null)
  const [done,     setDone]     = useState(false)

  const len       = text.length
  const charClass = 'char-count' + (len > 900 ? ' limit' : len > 750 ? ' warn' : '')

  async function handleSubmit() {
    if (len < 10) return
    setLoading(true); setResult(null); setApiError(null); setDone(false)
    try {
      const data = await callSentimentAPI(text)
      setResult(data)
      setDone(true)

      const stored = JSON.parse(localStorage.getItem('ae_reviews') || '[]')
      stored.push({
        id:        Date.now(),
        email:     localStorage.getItem('ae_email') || 'unknown',
        text,
        timestamp: new Date().toISOString(),
        sentiment: data.distilbert_label,
        score:     data.distilbert_score,
      })
      localStorage.setItem('ae_reviews', JSON.stringify(stored))
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cfg = result
    ? (SENT[result.distilbert_label] ?? { emoji: '🔍', color: '#0066cc', label: 'Thanks for sharing', bg: 'rgba(0,102,204,.08)' })
    : null

  return (
    <>
      <div className="ra-hero">
        <div className="ra-hero-icon">✈️</div>
        <div>
          <div className="ra-hero-title">Share Your Experience</div>
          <div className="ra-hero-sub">Your feedback helps us make every journey better.</div>
        </div>
      </div>

      <div className="page-body">

        <textarea
          className="review-textarea ra-textarea"
          placeholder="Tell us about your experience — the crew, cabin, meals, delays, or anything else that stood out…"
          maxLength={MAX_CHARS}
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); setApiError(null); setDone(false) }}
        />
        <div className={charClass}>{len} / {MAX_CHARS}</div>

        <button
          className="btn-primary ra-submit-btn"
          onClick={handleSubmit}
          disabled={len < 10 || loading}
        >
          {loading ? (
            <><span className="spinner" /> Submitting…</>
          ) : done ? (
            <>✓ Review Submitted</>
          ) : (
            <><SendIcon /> Submit Review</>
          )}
        </button>

        {apiError && (
          <div className="ra-error-card">
            <span>⚠️</span>
            <p>Something went wrong. Please try again in a moment.</p>
          </div>
        )}

        {result && cfg && (
          <div className="ra-result-card" style={{ '--sent-color': cfg.color, '--sent-bg': cfg.bg }}>
            <div className="ra-result-banner">
              <span className="ra-result-emoji">{cfg.emoji}</span>
              <div>
                <div className="ra-result-title">{cfg.label}</div>
                <div className="ra-result-sub">Review #{result.comment_id} · Thank you for taking the time!</div>
              </div>
            </div>

            <div className="ra-result-body">
              <div className="ra-score-label">Feedback score</div>
              <div className="ra-score-value" style={{ color: cfg.color }}>
                {Math.round(result.distilbert_score * 100)}%
              </div>
              <div className="ra-bar-track">
                <div className="ra-bar-fill" style={{ width: `${Math.round(result.distilbert_score * 100)}%`, background: cfg.color }} />
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
