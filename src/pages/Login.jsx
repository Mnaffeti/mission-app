import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [role,     setRole]     = useState('user')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(false)
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    if (email && password) {
      /* ── PLACEHOLDER: Replace with real authentication ──────────────
         Call your auth endpoint here. On success, store the user token
         and role, then navigate accordingly.
      ────────────────────────────────────────────────────────────────── */
      localStorage.setItem('ae_role',  role)
      localStorage.setItem('ae_email', email)
      setError(false)
      navigate(role === 'admin' ? '/admin' : '/user')
    } else {
      setError(true)
    }
  }

  return (
    <div className="login-page">
      <nav className="global-nav">
        <span className="nav-brand">FlySmart</span>
      </nav>

      <main className="login-main">
        <div className="login-card">

          <div className="login-logo-wrap">
            <img src="/esprit-logo.jpg" alt="ESPRIT" className="login-logo-img" />
          </div>

          <h1 className="login-h1">Welcome back.</h1>
          <p className="login-tagline">Sign in to access your workspace.</p>

          {/* Role selector */}
          <div className="role-row">
            {['user', 'admin'].map(r => (
              <button
                key={r}
                type="button"
                className={`chip${role === r ? ' selected' : ''}`}
                onClick={() => setRole(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                type="email" id="email"
                placeholder="you@airmail.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                type="password" id="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-msg">Incorrect email or password.</p>}

            <button className="btn-submit" type="submit">Sign In</button>
          </form>

        </div>
      </main>

      <footer className="login-footer">© 2025 FlySmart. All rights reserved.</footer>
    </div>
  )
}
