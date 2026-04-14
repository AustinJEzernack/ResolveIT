import React from 'react'
import { Link } from 'react-router-dom'
import '../styles/Home.css'

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <header className="navbar">
        <div className="navbar-content">
          <Link to="/" className="logo">ResolveIT</Link>
          <nav className="nav-links">
            <Link to="/about">About</Link>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
            <Link to="/login" className="login-btn">Login</Link>
          </nav>
        </div>
      </header>

      <main className="hero">
        <div className="hero-content">
          <h2>Welcome to ResolveIT</h2>
          <p>Your all-in-one ticket management and collaboration platform</p>
          <div className="cta-buttons">
            <button className="btn btn-primary">Get Started</button>
            <button className="btn btn-secondary">Learn More</button>
          </div>
        </div>
      </main>

      <section className="features">
        <h3>Key Features</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎫</div>
            <h4>Ticket Management</h4>
            <p>Create, track, and resolve tickets efficiently with our intuitive system.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h4>Real-time Messaging</h4>
            <p>Collaborate instantly with Discord/Slack-like messaging capabilities.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h4>Team Collaboration</h4>
            <p>Work together seamlessly with team members on ticket resolution.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h4>Workshops</h4>
            <p>Access training materials and workshops to improve your skills.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 ResolveIT. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default Home
