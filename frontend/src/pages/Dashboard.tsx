import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Info, AlertTriangle, X, Ticket, MessageSquare, Users, Settings } from 'lucide-react'
import apiClient from '@services/api'
import { clearAuthTokens, getAccessToken, getRefreshToken, type AuthUser } from '@services/auth'
import notificationService, { Notification } from '@services/notificationService'
import '../styles/Dashboard.css'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getNotifications())

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login')
      return
    }

    apiClient.get('/auth/me/')
      .then((response) => setUser(response.data as AuthUser))
      .catch(() => {
        clearAuthTokens()
        navigate('/login')
      })
  }, [navigate])

  const handleLogout = () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      apiClient.post('/auth/logout/', { refresh_token: refreshToken }).catch(() => {})
    }
    clearAuthTokens()
    navigate('/login')
  }

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id)
    setNotifications([...notifications])
  }

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead()
    setNotifications([...notifications])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-content">
          <img src="/resolveIT_logo_final.svg" alt="ResolveIT" height={28} />
          <div className="navbar-user">
            <span className="user-name">{user?.first_name} {user?.last_name}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper">
        {/* Activity Log Sidebar */}
        <aside className="activity-sidebar">
          <div className="sidebar-header">
            <h2>Activity Log</h2>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="mark-all-btn">
                Mark all as read
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="empty-state">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {notification.type === 'success' && <Check size={16} strokeWidth={1.75} />}
                    {notification.type === 'info' && <Info size={16} strokeWidth={1.75} />}
                    {notification.type === 'warning' && <AlertTriangle size={16} strokeWidth={1.75} />}
                    {notification.type === 'error' && <X size={16} strokeWidth={1.75} />}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {notificationService.formatTime(notification.timestamp)}
                    </span>
                  </div>
                  {!notification.read && <div className="unread-indicator"></div>}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          <div className="welcome-section">
            <h1>Welcome, {user?.first_name}!</h1>
            <p>You are successfully logged in to ResolveIT</p>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon"><Ticket size={16} strokeWidth={1.75} /></div>
              <h3>Tickets</h3>
              <p>Manage your support tickets</p>
              <button className="card-btn">View Tickets</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon"><MessageSquare size={16} strokeWidth={1.75} /></div>
              <h3>Messages</h3>
              <p>Chat with your team members</p>
              <button className="card-btn">Open Messages</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon"><Users size={16} strokeWidth={1.75} /></div>
              <h3>Workshops</h3>
              <p>Manage your workshops</p>
              <button className="card-btn" onClick={() => navigate('/workshop')}>View Workshops</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon"><Settings size={16} strokeWidth={1.75} /></div>
              <h3>Settings</h3>
              <p>Manage your account settings</p>
              <button className="card-btn">Go to Settings</button>
            </div>
          </div>

          <section className="info-section">
            <h2>Quick Info</h2>
            <div className="info-box">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Account Status:</strong> <span className="status-active">Active</span></p>
              <p><strong>Auth Token:</strong> <code className="token">{localStorage.getItem('access_token')?.substring(0, 20)}...</code></p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
