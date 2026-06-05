import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const POWER_BI_EMBED_URL = ''
const ACTION_API = 'http://localhost:5001/analyze-review'

const SENT_CFG = {
  positive: { color: '#34c759', label: 'Positive', emoji: '😊' },
  negative: { color: '#ff453a', label: 'Negative', emoji: '😞' },
  neutral:  { color: '#ff9f0a', label: 'Neutral',  emoji: '😐' },
}

const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const ReviewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

function formatTs(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function Avatar({ email }) {
  const letter = (email?.[0] ?? '?').toUpperCase()
  return (
    <div className="rc-avatar">{letter}</div>
  )
}

function SentimentBadge({ sentiment }) {
  const cfg = SENT_CFG[sentiment] ?? { color: '#7a7a7a', label: sentiment, emoji: '🔍' }
  return (
    <span className="rc-badge" style={{ color: cfg.color, borderColor: cfg.color + '33', background: cfg.color + '12' }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function ReviewCard({ entry }) {
  return (
    <div className="review-card">
      <div className="rc-header">
        <Avatar email={entry.email} />
        <div className="rc-meta">
          <span className="rc-email">{entry.email}</span>
          <span className="rc-time">{formatTs(entry.timestamp)}</span>
        </div>
        <SentimentBadge sentiment={entry.sentiment} />
      </div>

      <p className="rc-text">"{entry.text}"</p>

      <div className="rc-action">
        <span className="rc-action-label">Recommended action</span>
        {entry.actionLoading ? (
          <span className="rc-action-loading">Analyzing…</span>
        ) : entry.actionError ? (
          <span className="rc-action-error">{entry.actionError}</span>
        ) : (
          <p className="rc-action-text">{entry.action ?? '—'}</p>
        )}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const email    = localStorage.getItem('ae_email') || ''

  const [panelOpen, setPanelOpen] = useState(false)
  const [entries,   setEntries]   = useState([])
  const [fetching,  setFetching]  = useState(false)
  const listEndRef                = useRef(null)

  useEffect(() => {
    if (localStorage.getItem('ae_role') !== 'admin') navigate('/')
  }, [navigate])

  useEffect(() => {
    if (listEndRef.current) listEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  async function loadReviews() {
    const raw = JSON.parse(localStorage.getItem('ae_reviews') || '[]')
    if (!raw.length) { setEntries([]); return }

    setFetching(true)
    const initial = raw.map(r => ({ ...r, actionLoading: true, action: null, actionError: null }))
    setEntries(initial)

    const updated = await Promise.all(
      raw.map(async r => {
        try {
          const res  = await fetch(ACTION_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ review: r.text }),
          })
          const data = await res.json()
          return { ...r, actionLoading: false, action: data.message, actionError: null }
        } catch {
          return { ...r, actionLoading: false, action: null, actionError: 'API unavailable' }
        }
      })
    )
    setEntries(updated)
    setFetching(false)
  }

  function handleOpenPanel() {
    setPanelOpen(true)
    loadReviews()
  }

  function signOut() {
    localStorage.removeItem('ae_role')
    localStorage.removeItem('ae_email')
    navigate('/')
  }

  return (
    <div className="admin-page">

      {/* Global Nav */}
      <nav className="global-nav">
        <span className="nav-brand">AirEsprit</span>
        <div className="nav-right">
          <span className="nav-email">{email}</span>
          <button className="nav-signout-btn" onClick={signOut}>
            <SignOutIcon /> Sign Out
          </button>
        </div>
      </nav>

      {/* Sub Nav */}
      <div className="sub-nav">
        <span className="sub-nav-title">Power BI Dashboard</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="sub-nav-hint">Admin view</span>
          <button
            className={`review-panel-toggle${panelOpen ? ' active' : ''}`}
            onClick={panelOpen ? () => setPanelOpen(false) : handleOpenPanel}
          >
            <ReviewIcon /> Customer Reviews
            {entries.length > 0 && (
              <span className="rpt-badge">{entries.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Dashboard + Side Panel wrapper */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Main dashboard */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {POWER_BI_EMBED_URL ? (
            <iframe
              title="AirEsprit Power BI Dashboard"
              src={POWER_BI_EMBED_URL}
              className="powerbi-frame"
              allowFullScreen
            />
          ) : (
            <div className="pbi-placeholder">
              <div className="pbi-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                     stroke="#0066cc" strokeWidth="1.5"
                     strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 17v-5M12 17v-8M15 17v-3" />
                </svg>
              </div>
              <h2>Connect your Power BI report</h2>
              <p>
                Paste your exported embed URL into <code>AdminDashboard.jsx</code> to
                display the dashboard here.
              </p>
              <div className="pbi-steps">
                <ol>
                  <li>Open your report in <strong>Power BI Service</strong></li>
                  <li>Go to <strong>File → Embed report → Website or portal</strong></li>
                  <li>Copy the <code>src</code> URL from the generated <code>&lt;iframe&gt;</code></li>
                  <li>Set <code>const POWER_BI_EMBED_URL = 'paste-url-here'</code> at the top of this file</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Customer Review Side Panel */}
        <div className={`review-panel${panelOpen ? ' open' : ''}`}>
          <div className="review-panel-header">
            <span className="review-panel-title">Customer Reviews</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="review-panel-close"
                onClick={loadReviews}
                disabled={fetching}
                title="Refresh"
                style={{ opacity: fetching ? 0.5 : 1 }}
              >
                <RefreshIcon />
              </button>
              <button className="review-panel-close" onClick={() => setPanelOpen(false)}>
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="review-list">
            {entries.length === 0 ? (
              <div className="review-empty">
                No customer reviews yet. Reviews submitted by passengers will appear here.
              </div>
            ) : (
              entries.map(entry => <ReviewCard key={entry.id} entry={entry} />)
            )}
            <div ref={listEndRef} />
          </div>
        </div>

      </div>
    </div>
  )
}
