import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/* ════════════════════════════════════════════════════════════
   TODO: Paste your Power BI embed URL here.
   Power BI → File → Embed report → Website or portal → copy the src URL.
   e.g. 'https://app.powerbi.com/reportEmbed?reportId=xxxx&...'
════════════════════════════════════════════════════════════ */
const POWER_BI_EMBED_URL = ''

const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

export default function AdminDashboard() {
  const navigate = useNavigate()
  const email    = localStorage.getItem('ae_email') || ''

  useEffect(() => {
    if (localStorage.getItem('ae_role') !== 'admin') navigate('/')
  }, [navigate])

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
        <span className="sub-nav-hint">Admin view</span>
      </div>

      {/* Dashboard area */}
      <div className="dash-area">
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

    </div>
  )
}
