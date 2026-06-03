import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PassportScanner from '../components/PassportScanner'
import ReviewAnalyzer  from '../components/ReviewAnalyzer'

const PassportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="8" cy="12" r="2.5" />
    <path d="M14 9h4M14 13h2" />
  </svg>
)
const ReviewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const SignOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const PAGES = [
  { id: 'passport', label: 'Passport Scanner', Icon: PassportIcon },
  { id: 'review',   label: 'Review Analyzer',  Icon: ReviewIcon   },
]

export default function UserApp() {
  const [activePage, setActivePage] = useState('passport')
  const navigate = useNavigate()
  const email = localStorage.getItem('ae_email') || 'user@airmail.com'

  useEffect(() => {
    if (localStorage.getItem('ae_role') !== 'user') navigate('/')
  }, [navigate])

  function signOut() {
    localStorage.removeItem('ae_role')
    localStorage.removeItem('ae_email')
    navigate('/')
  }

  const initial = email[0]?.toUpperCase() ?? 'U'
  const name    = email.split('@')[0]

  return (
    <div className="user-app">

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

      <div className="app-shell">

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-user">
            <div className="sidebar-logo-wrap">
              <img src="/esprit-logo.jpg" alt="ESPRIT" className="sidebar-logo" />
            </div>
            <div className="user-avatar">{initial}</div>
            <div className="user-name">{name}</div>
            <div className="user-role">Passenger</div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">AI Services</div>
            {PAGES.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`nav-item${activePage === id ? ' active' : ''}`}
                onClick={() => setActivePage(id)}
              >
                <Icon /> {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <button className="btn-signout-side" onClick={signOut}>
              <SignOutIcon /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="user-main">
          {activePage === 'passport' ? <PassportScanner /> : <ReviewAnalyzer />}
        </main>

      </div>
    </div>
  )
}
