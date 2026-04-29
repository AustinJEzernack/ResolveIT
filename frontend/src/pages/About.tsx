import React from 'react'
import { Link } from 'react-router-dom'
import { Users, Lock, Settings, BarChart2, Ticket, MessageSquare, Clock, Shield, ClipboardList, Activity } from 'lucide-react'
import '../styles/About.css'

const About: React.FC = () => {
  return (
    <div className="about-container">
      <header className="navbar">
        <div className="navbar-content">
          <Link to="/" className="logo">
            <img src="/resolveit-wordmark-white.svg" alt="ResolveIT" height={28} />
          </Link>
          <nav className="nav-links">
            <Link to="/about">About</Link>
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#contact">Contact</a>
            <Link to="/login" className="login-btn">Login</Link>
          </nav>
        </div>
      </header>

      <main className="about-main">
        <section className="about-hero">
          <div className="about-hero-content">
            <h1>About ResolveIT</h1>
            <p>Streamlining IT support through collaborative workshops and intelligent ticket management</p>
          </div>
        </section>

        <section className="about-section" id="workshops">
          <div className="section-container">
            <h2>What Are Workshops?</h2>
            <p>
              Workshops are collaborative spaces designed for teams and organizations to work together on IT support tasks. 
              Each workshop creates an isolated environment where team members can manage tickets, communicate in real-time, 
              and resolve issues collaboratively.
            </p>
            <div className="workshops-grid">
              <div className="workshop-card">
                <div className="icon"><Users size={24} strokeWidth={1.75} /></div>
                <h3>Team Collaboration</h3>
                <p>Bring your team together in a dedicated workspace to solve problems faster</p>
              </div>
              <div className="workshop-card">
                <div className="icon"><Lock size={24} strokeWidth={1.75} /></div>
                <h3>Secure &amp; Isolated</h3>
                <p>Each workshop has its own isolated environment with role-based access controls</p>
              </div>
              <div className="workshop-card">
                <div className="icon"><Settings size={24} strokeWidth={1.75} /></div>
                <h3>Customizable</h3>
                <p>Configure your workshop settings, team members, and workflows to match your needs</p>
              </div>
              <div className="workshop-card">
                <div className="icon"><BarChart2 size={24} strokeWidth={1.75} /></div>
                <h3>Analytics</h3>
                <p>Track ticket resolution times, team performance, and get actionable insights</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section alt">
          <div className="section-container">
            <h2>How to Create a Workshop</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Sign Up or Login</h3>
                  <p>Create your ResolveIT account or login to your existing account</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Create New Workshop</h3>
                  <p>Click "New Workshop" and enter your workshop name and description</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Invite Team Members</h3>
                  <p>Add team members by email and assign them roles (Owner or Technician)</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Configure Settings</h3>
                  <p>Set up your workshop preferences, notification settings, and integrations</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">5</div>
                <div className="step-content">
                  <h3>Start Managing Tickets</h3>
                  <p>Create your first ticket and begin collaborating with your team</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section">
          <div className="section-container">
            <h2>Key Features</h2>
            <div className="features-list">
              <div className="feature-item">
                <div className="feature-title"><Ticket size={16} strokeWidth={1.75} /> Intelligent Ticket Management</div>
                <p>Create, assign, and track tickets with multiple status levels and priority settings. Set urgency levels from LOW to CRITICAL to ensure important issues are addressed first.</p>
              </div>
              <div className="feature-item">
                <div className="feature-title"><MessageSquare size={16} strokeWidth={1.75} /> Real-Time Messaging</div>
                <p>Collaborate with your team through encrypted, real-time messaging. Similar to Discord or Slack, but integrated directly into your ticket workflow.</p>
              </div>
              <div className="feature-item">
                <div className="feature-title"><Clock size={16} strokeWidth={1.75} /> Work Logs &amp; Time Tracking</div>
                <p>Technicians can log time spent on tickets and add detailed notes. Perfect for tracking billable hours and maintaining a historical record.</p>
              </div>
              <div className="feature-item">
                <div className="feature-title"><Shield size={16} strokeWidth={1.75} /> Enterprise Security</div>
                <p>End-to-end encryption for messages, JWT authentication with rotating tokens, and role-based access control keep your data secure.</p>
              </div>
              <div className="feature-item">
                <div className="feature-title"><ClipboardList size={16} strokeWidth={1.75} /> Role-Based Permissions</div>
                <p>Manage access with OWNER and TECHNICIAN roles. Control who can create, edit, and resolve tickets in your workshop.</p>
              </div>
              <div className="feature-item">
                <div className="feature-title"><Activity size={16} strokeWidth={1.75} /> Audit Logging</div>
                <p>Complete audit trail of all actions taken in your workshop. Track changes, monitor user activity, and maintain compliance records.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section alt">
          <div className="section-container">
            <h2>Why Choose ResolveIT?</h2>
            <div className="reasons">
              <div className="reason">
                <h3>Designed for IT Teams</h3>
                <p>Built specifically for IT support operations, not a generic project management tool adapted for IT.</p>
              </div>
              <div className="reason">
                <h3>Multi-Tenant Architecture</h3>
                <p>Support multiple teams or departments without interference. Each workshop is completely isolated.</p>
              </div>
              <div className="reason">
                <h3>Real-Time Collaboration</h3>
                <p>WebSocket-powered real-time messaging and updates keep your team synchronized without delays.</p>
              </div>
              <div className="reason">
                <h3>Security First</h3>
                <p>Enterprise-grade encryption, secure authentication, and comprehensive audit logs for compliance.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="section-container">
            <h2>Ready to Get Started?</h2>
            <p>Join teams worldwide using ResolveIT to streamline their IT support operations</p>
            <Link to="/login" className="btn btn-primary">Login Now</Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>ResolveIT</h4>
            <p>Intelligent IT support management platform</p>
          </div>
          <div className="footer-section">
            <h4>Links</h4>
            <ul>
              <li><a href="/#about">About</a></li>
              <li><a href="/#features">Features</a></li>
              <li><a href="/#pricing">Pricing</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Report Bug</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 ResolveIT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default About
