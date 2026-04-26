import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import apiClient from '@services/api'
import '../styles/SignUp.css'

function slugifyWorkshopName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const SignUp: React.FC = () => {
  const [accountType, setAccountType] = useState<'manager' | 'technician'>('manager')
  const [formData, setFormData] = useState({
    workshop_name: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const workshopSlug = slugifyWorkshopName(formData.workshop_name)

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const response = accountType === 'manager'
        ? await apiClient.post('/auth/register/', {
            workshop_name: formData.workshop_name || null,
            workshop_slug: workshopSlug || null,
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name,
          })
        : await apiClient.post('/auth/register-technician/', {
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name,
          })

      const payload = response.data?.data

      // Store tokens
      localStorage.setItem('access_token', payload?.access_token ?? '')
      localStorage.setItem('refresh_token', payload?.refresh_token ?? '')

      // Redirect to dashboard
      navigate('/dashboard')
    } catch (err: any) {
      const data = err.response?.data
      setError(
        data?.detail ||
        data?.workshop_slug?.[0] ||
        data?.workshop_name?.[0] ||
        data?.email?.[0] ||
        'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <Link to="/" className="logo-link">ResolveIT</Link>
          <p className="subtitle">Create your account</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="signup-role-group" role="radiogroup" aria-label="Account Type">
            <span className="signup-role-label">I am signing up as</span>
            <div className="signup-role-options">
              <label className={`signup-role-option ${accountType === 'manager' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="account_type"
                  value="manager"
                  checked={accountType === 'manager'}
                  onChange={() => setAccountType('manager')}
                />
                Manager
              </label>
              <label className={`signup-role-option ${accountType === 'technician' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="account_type"
                  value="technician"
                  checked={accountType === 'technician'}
                  onChange={() => setAccountType('technician')}
                />
                Technician
              </label>
            </div>
          </div>

          {accountType === 'manager' ? (
            <div className="form-group">
              <label htmlFor="workshop_name">Workshop Name (Optional)</label>
              <input
                id="workshop_name"
                name="workshop_name"
                type="text"
                value={formData.workshop_name}
                onChange={handleChange}
                placeholder="Acme IT"
              />
            </div>
          ) : null}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
            <small className="password-hint">At least 8 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="password_confirm">Confirm Password</label>
            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              value={formData.password_confirm}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-signup" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="signup-footer">
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  )
}

export default SignUp
