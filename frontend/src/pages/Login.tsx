import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import apiClient from '@services/api'
import '../styles/Login.css'

const SSO_PROVIDERS = [
  { label: 'SSO', icon: '🔑' },
  { label: 'Google', icon: 'G' },
  { label: 'GitHub', icon: '⌥' },
]

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiClient.post('/auth/token/', { email, password })

      // Store tokens
      localStorage.setItem('access_token', response.data.access)
      localStorage.setItem('refresh_token', response.data.refresh)

      // Redirect to dashboard
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <Link to="/" className="logo-img">
            <img src="/resolveit-wordmark-white.svg" alt="ResolveIT" height={32} />
          </Link>
          <p className="subtitle">Welcome back</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="sso-divider">Or continue with</div>
        <div className="sso-row">
          {SSO_PROVIDERS.map((p) => (
            <button key={p.label} className="sso-btn" type="button" disabled>
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        <div className="login-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
          <p><a href="/forgot-password">Forgot password?</a></p>
        </div>
      </div>
    </div>
  )
}

export default Login
