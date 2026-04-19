import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mockAuth from '@services/mockAuth'
import notificationService, { Notification } from '@services/notificationService'
import CreateWorkshopModal from '@components/CreateWorkshopModal'
import WorkshopItem from '@components/WorkshopItem'
import '../styles/Dashboard.css'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const user = mockAuth.getCurrentUser()
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getNotifications())
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [workshops, setWorkshops] = useState([
    { id: '1', name: 'React Development', description: 'Learn React fundamentals', memberCount: 12 },
    { id: '2', name: 'Web Design', description: 'Create beautiful websites', memberCount: 8 },
  ])

  const handleLogout = () => {
    mockAuth.logout()
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

  const handleWorkshopCreated = () => {
    notificationService.addNotification({
      message: 'Workshop created successfully!',
      type: 'success',
      duration: 5000,
    })
    setNotifications([...notificationService.getNotifications()])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-content">
          <h1 className="navbar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>ResolveIT</h1>
          <div className="navbar-user">
            <span className="user-name">{user?.first_name} {user?.last_name}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
            <div className="dropdown-container">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="dropdown-toggle"
              >
                ⋮
              </button>
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item">👤 Profile</button>
                  <button className="dropdown-item">🎫 Tickets</button>
                  <button className="dropdown-item">💬 Messages</button>
                  <button className="dropdown-item">⚙️ Settings</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper">
        {/* Activity Log Sidebar */}
        <aside className={`activity-sidebar ${isSidebarHidden ? 'hidden' : ''}`}>
          <div className="sidebar-header">
            <h2>Activity Log</h2>
            <div className="sidebar-actions">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllAsRead} className="mark-all-btn">
                  Mark all as read
                </button>
              )}
              <button 
                className="toggle-sidebar-btn"
                onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                title={isSidebarHidden ? "Show Activity Bar" : "Hide Activity Bar"}
              >
                {isSidebarHidden ? '→' : '←'}
              </button>
            </div>
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
                    {notification.type === 'success' && '✓'}
                    {notification.type === 'info' && 'ℹ'}
                    {notification.type === 'warning' && '⚠'}
                    {notification.type === 'error' && '✕'}
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

        {/* Floating sidebar toggle when hidden */}
        {isSidebarHidden && (
          <button
            className="floating-toggle-btn"
            onClick={() => setIsSidebarHidden(false)}
            title="Show Activity Bar"
          >
            →
          </button>
        )}

        {/* Main Content */}
        <main className="dashboard-main">
          <div className="welcome-section">
            <h1>Welcome, {user?.first_name}!</h1>
            <p>You are successfully logged in to ResolveIT</p>
          </div>

          <div className="dashboard-grid">
          </div>

          <section className="workshop-section">
            <div className="workshop-header">
              <h2>Your Workshops</h2>
              <button className="navbar-btn" onClick={() => setIsCreateModalOpen(true)}>
                Create Workshop
              </button>
            </div>
            <div className="workshops-container">
              {workshops.length === 0 ? (
                <div className="empty-state">
                  <p>No workshops yet</p>
                </div>
              ) : (
                workshops.map((workshop) => (
                  <WorkshopItem
                    key={workshop.id}
                    id={workshop.id}
                    name={workshop.name}
                    description={workshop.description}
                    memberCount={workshop.memberCount}
                  />
                ))
              )}
            </div>
          </section>

          <section className="tickets-section">
            <h2>Your Tickets</h2>
            <div className="tickets-container">
              <div className="empty-state">
                <p>No tickets yet</p>
              </div>
            </div>
          </section>

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

      <CreateWorkshopModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleWorkshopCreated}
      />
    </div>
  )
}

export default Dashboard
