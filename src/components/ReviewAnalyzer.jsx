import { useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const MAX_CHARS = 1000
const API_URL = 'http://localhost:8000/analyse'

const SENT = {
  positive: { emoji: '😊', color: '#34c759', label: 'Positive' },
  negative: { emoji: '😞', color: '#ff453a', label: 'Negative' },
  neutral:  { emoji: '😐', color: '#ff9f0a', label: 'Neutral'  },
}

async function callSentimentAPI(text) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: text }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

/* ── Donut gauge for the current review ─────────────────────── */
function SentimentDonut({ label, score }) {
  const cfg = SENT[label] ?? SENT.neutral
  const pct = Math.round(score * 100)
  return (
    <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ value: pct }, { value: 100 - pct }]}
            cx="50%" cy="50%"
            innerRadius={50} outerRadius={66}
            startAngle={90} endAngle={-270}
            dataKey="value" strokeWidth={0}
            isAnimationActive
          >
            <Cell fill={cfg.color} />
            <Cell fill="#e8e8ed" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>{cfg.emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: cfg.color, letterSpacing: '-0.3px' }}>{pct}%</span>
      </div>
    </div>
  )
}

/* ── Custom tooltip for the bar chart ───────────────────────── */
function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 10,
      padding: '8px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,.10)',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <div style={{ color: '#7a7a7a', marginBottom: 2 }}>{d.name}</div>
      <div style={{ fontWeight: 600, color: d.fill }}>{d.label} · {d.score}%</div>
    </div>
  )
}

/* ── Bar chart: one bar per submitted review ─────────────────── */
function HistoryChart({ history }) {
  if (!history.length) return null
  const data = history.map(h => ({
    name: `#${h.comment_id}`,
    score: Math.round(h.distilbert_score * 100),
    fill: (SENT[h.distilbert_label] ?? SENT.neutral).color,
    label: (SENT[h.distilbert_label] ?? SENT.neutral).label,
  }))
  const barSize = Math.min(52, Math.max(18, Math.floor(360 / data.length)))

  return (
    <div style={{ marginTop: 30 }}>
      <SectionLabel>Submission History</SectionLabel>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} barSize={barSize} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#7a7a7a', fontSize: 12 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#7a7a7a', fontSize: 12 }}
            axisLine={false} tickLine={false}
            unit="%"
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,.04)', radius: 4 }} />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} isAnimationActive>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Distribution donut: only after 2+ reviews ──────────────── */
function DistributionPie({ history }) {
  if (history.length < 2) return null

  const counts = {}
  history.forEach(h => {
    counts[h.distilbert_label] = (counts[h.distilbert_label] ?? 0) + 1
  })
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: SENT[k]?.label ?? k, value: v, fill: SENT[k]?.color ?? '#0066cc' }))

  return (
    <div style={{
      marginTop: 20,
      padding: '20px 22px',
      background: '#f5f5f7',
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SectionLabel>Overall Distribution</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {data.map(d => {
            const pct = Math.round((d.value / history.length) * 100)
            return (
              <div key={d.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#7a7a7a', minWidth: 64 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>
                    {d.value} review{d.value !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#7a7a7a', marginLeft: 'auto' }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: '#e0e0e0', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: d.fill, borderRadius: 9999, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <PieChart width={110} height={110}>
        <Pie
          data={data} cx="50%" cy="50%"
          innerRadius={30} outerRadius={50}
          dataKey="value" strokeWidth={3} stroke="#f5f5f7"
          isAnimationActive
        >
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
      </PieChart>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
      textTransform: 'uppercase', color: '#7a7a7a',
    }}>
      {children}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────── */
export default function ReviewAnalyzer() {
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [apiError, setApiError] = useState(null)
  const [history,  setHistory]  = useState([])

  const len       = text.length
  const charClass = 'char-count' + (len > 900 ? ' limit' : len > 750 ? ' warn' : '')

  async function analyze() {
    if (len < 10) return
    setLoading(true); setResult(null); setApiError(null)
    try {
      const data = await callSentimentAPI(text)
      setResult(data)
      setHistory(prev => [...prev, data])
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cfg = result
    ? (SENT[result.distilbert_label] ?? { emoji: '🔍', color: '#0066cc', label: result.distilbert_label })
    : null

  return (
    <>
      <div className="page-header">
        <div className="page-title">Review Analyzer</div>
        <div className="page-subtitle">
          Share your flight experience and get instant sentiment analysis.
        </div>
      </div>

      <div className="page-body">
        <textarea
          className="review-textarea"
          placeholder="Share your experience — the flight, crew, cabin, food…"
          maxLength={MAX_CHARS}
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); setApiError(null) }}
        />
        <div className={charClass}>{len} / {MAX_CHARS}</div>

        <button
          className="btn-primary"
          onClick={analyze}
          disabled={len < 10 || loading}
        >
          {loading && <span className="spinner" />}
          {loading ? 'Analyzing…' : len < 10 ? 'Write at least 10 characters' : 'Analyze Sentiment'}
        </button>

        {apiError && (
          <div className="result-card" style={{ marginTop: 20 }}>
            <div className="sentiment-body">
              <p style={{ color: 'var(--red)', fontSize: 14 }}>
                {apiError}
                {apiError.includes('fetch') && (
                  <> — make sure the DistilBERT API is running on <code>localhost:8000</code></>
                )}
              </p>
            </div>
          </div>
        )}

        {result && cfg && (
          <div className="result-card" style={{ marginTop: 20 }}>
            <div className="result-header">
              <div className="status-icon status-ok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 13s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
                  <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
                </svg>
              </div>
              <div>
                <div className="result-title">Sentiment Analysis</div>
                <div className="result-sub">Review #{result.comment_id} · Powered by DistilBERT</div>
              </div>
            </div>

            <div className="sentiment-body">
              {/* Label + donut side by side */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16, marginBottom: 20,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sentiment-row" style={{ marginBottom: 14 }}>
                    <span className="sentiment-emoji">{cfg.emoji}</span>
                    <div>
                      <div className="sentiment-label" style={{ color: cfg.color }}>{cfg.label}</div>
                      <div className="sentiment-confidence">
                        {Math.round(result.distilbert_score * 100)}% confidence
                      </div>
                    </div>
                  </div>

                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.round(result.distilbert_score * 100)}%`, background: cfg.color }}
                    />
                  </div>

                  {result.text_clean && (
                    <p className="sentiment-detail" style={{ marginTop: 14 }}>
                      {result.text_clean.length > 150
                        ? result.text_clean.slice(0, 150) + '…'
                        : result.text_clean}
                    </p>
                  )}
                </div>

                <SentimentDonut label={result.distilbert_label} score={result.distilbert_score} />
              </div>

              {/* Charts */}
              <HistoryChart history={history} />
              <DistributionPie history={history} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
