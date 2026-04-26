import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Check, Info, AlertTriangle, X, Ticket, MessageSquare, Users, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import apiClient from '@services/api'
import { clearAuthTokens, getAccessToken, getRefreshToken, type AuthUser } from '@services/auth'
import notificationService, { Notification } from '@services/notificationService'
import '../styles/Dashboard.css'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getNotifications())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [workshops, setWorkshops] = useState<any[]>([])
  const [workshopsLoading, setWorkshopsLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [showWorkshopModal, setShowWorkshopModal] = useState(false)
  const [workshopFormData, setWorkshopFormData] = useState({ name: '', description: '' })
  const [creatingWorkshop, setCreatingWorkshop] = useState(false)

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

  useEffect(() => {
    if (user) {
      apiClient.get('/workshops/me/')
        .then((response) => {
          setWorkshops(response.data ? [response.data] : [])
          setWorkshopsLoading(false)
        })
        .catch((error) => {
          // 404 means the user has no workshop yet — that's a normal state
          if (error.response?.status !== 404) {
            console.error('Failed to load workshops:', error)
          }
          setWorkshops([])
          setWorkshopsLoading(false)
        })
    }
  }, [user])

  useEffect(() => {
    if (user) {
      apiClient.get('/tickets/assigned/')
        .then((response) => {
          // Handle both list and paginated responses
          const ticketData = Array.isArray(response.data) ? response.data : response.data.results || []
          setTickets(ticketData)
          setTicketsLoading(false)
        })
        .catch((error) => {
          console.error('Failed to load tickets:', error)
          setTickets([])
          setTicketsLoading(false)
        })
    }
  }, [user])

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

  const handleCreateWorkshop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workshopFormData.name.trim()) {
      alert('Workshop name is required')
      return
    }

    setCreatingWorkshop(true)
    try {
      const response = await apiClient.post('/workshops/create/', {
        name: workshopFormData.name,
        description: workshopFormData.description,
      })
      
      // Add new workshop to the list
      setWorkshops([...workshops, response.data])
      setShowWorkshopModal(false)
      setWorkshopFormData({ name: '', description: '' })
      // Do not navigate — just add to "Your Workshops" list
    } catch (error) {
      console.error('Failed to create workshop:', error)
      alert('Failed to create workshop')
    } finally {
      setCreatingWorkshop(false)
    }
  }

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const modal = document.querySelector('.workshop-modal-content')
      const btn = document.querySelector('.create-workshop-btn')
      if (modal && !modal.contains(event.target as Node) && !btn?.contains(event.target as Node)) {
        setShowWorkshopModal(false)
      }
    }

    if (showWorkshopModal) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showWorkshopModal])



  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-content">
          <Link to="/" className="logo-link">ResolveIT</Link>
          <div className="navbar-user">
            <span className="user-name">{user?.first_name} {user?.last_name}</span>
            <div className="navbar-menu">
              <button onClick={() => setMenuOpen(!menuOpen)} className="menu-btn">☰</button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false) }}>
                    <MessageSquare size={16} strokeWidth={1.75} />
                    <span>Messages</span>
                  </button>
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false) }}>
                    <Settings size={16} strokeWidth={1.75} />
                    <span>Settings</span>
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    <X size={16} strokeWidth={1.75} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper">
        {/* Activity Log Sidebar */}
        <aside className={`activity-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-toggle">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="toggle-btn" 
              title={sidebarOpen ? 'Close activity log' : 'Open activity log'}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
          
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
          </div>

          <section className="workshops-section">
            <div className="workshops-header">
              <h2>Your Workshops</h2>
              {user?.role?.toLowerCase() === 'owner' && (
                <button className="create-workshop-btn" onClick={() => setShowWorkshopModal(true)}>
                  Create Workshop
                </button>
              )}
            </div>
            {workshopsLoading ? (
              <p>Loading workshops...</p>
            ) : workshops.length === 0 ? (
              <p className="empty-workshops">You are not in any workshops yet.</p>
            ) : (
              <div className="workshops-list">
                {workshops.map((workshop) => (
                  <div key={workshop.id} className="workshop-item">
                    <div className="workshop-info">
                      <h3>{workshop.name}</h3>
                    </div>
                    <button 
                      className="workshop-btn"
                      onClick={() => navigate('/workshop')}
                    >
                      Enter Workshop
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="tickets-section">
            <h2>Your Tickets</h2>
            {ticketsLoading ? (
              <p>Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="empty-tickets">No tickets assigned to you.</p>
            ) : (
              <div className="tickets-list">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="ticket-item">
                    <div className="ticket-info">
                      <h3>{ticket.title}</h3>
                      <p className="ticket-user">From: {ticket.requestor?.first_name} {ticket.requestor?.last_name}</p>
                    </div>
                    <button 
                      className="ticket-details-btn"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedTicket && (
            <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Ticket Details</h2>
                  <button 
                    className="modal-close"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="detail-row">
                    <strong>Title:</strong>
                    <p>{selectedTicket.title}</p>
                  </div>
                  <div className="detail-row">
                    <strong>Description:</strong>
                    <p>{selectedTicket.description}</p>
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong>
                    <p className={`status-badge status-${ticket.status?.toLowerCase()}`}>
                      {ticket.status}
                    </p>
                  </div>
                  <div className="detail-row">
                    <strong>Urgency:</strong>
                    <p>{selectedTicket.urgency}</p>
                  </div>
                  <div className="detail-row">
                    <strong>Requested By:</strong>
                    <p>{selectedTicket.requestor?.first_name} {selectedTicket.requestor?.last_name} ({selectedTicket.requestor?.email})</p>
                  </div>
                  <div className="detail-row">
                    <strong>Assigned To:</strong>
                    <p>{selectedTicket.assignee?.first_name} {selectedTicket.assignee?.last_name}</p>
                  </div>
                  <div className="detail-row">
                    <strong>Created:</strong>
                    <p>{new Date(selectedTicket.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    className="modal-btn"
                    onClick={() => navigate(`/tickets`)}
                  >
                    Go to Tickets
                  </button>
                  <button 
                    className="modal-btn modal-btn-close"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showWorkshopModal && (
            <div className="workshop-modal-overlay" onClick={() => setShowWorkshopModal(false)}>
              <div className="workshop-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="workshop-modal-header">
                  <h2>Create Workshop</h2>
                  <button 
                    className="workshop-modal-close"
                    onClick={() => setShowWorkshopModal(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleCreateWorkshop}>
                  <div className="form-group">
                    <label htmlFor="workshop-name">Workshop Name</label>
                    <input
                      id="workshop-name"
                      type="text"
                      placeholder="Enter workshop name"
                      value={workshopFormData.name}
                      onChange={(e) => setWorkshopFormData({ ...workshopFormData, name: e.target.value })}
                      disabled={creatingWorkshop}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="workshop-desc">Description (Optional)</label>
                    <textarea
                      id="workshop-desc"
                      placeholder="Enter workshop description"
                      value={workshopFormData.description}
                      onChange={(e) => setWorkshopFormData({ ...workshopFormData, description: e.target.value })}
                      disabled={creatingWorkshop}
                      rows={4}
                    />
                  </div>
                  <div className="workshop-modal-footer">
                    <button 
                      type="button"
                      className="modal-btn-cancel"
                      onClick={() => setShowWorkshopModal(false)}
                      disabled={creatingWorkshop}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="modal-btn-create"
                      disabled={creatingWorkshop}
                    >
                      {creatingWorkshop ? 'Creating...' : 'Create Workshop'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
