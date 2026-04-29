import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Check, Info, AlertTriangle, X, MessageSquare, Settings, ChevronLeft, ChevronRight, LayoutDashboard, Ticket, Users, BarChart2 } from 'lucide-react'
import apiClient from '@services/api'
import { clearAuthTokens, getAccessToken, getRefreshToken, type AuthUser } from '@services/auth'
import notificationService, { Notification } from '@services/notificationService'
import { connectWebSocket } from '@services/messagingService'
import '../styles/Dashboard.css'

function unwrapListPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const data = payload as { data?: unknown; results?: unknown }
    if (Array.isArray(data.data)) return data.data as T[]
    if (Array.isArray(data.results)) return data.results as T[]
    if (data.data && typeof data.data === 'object') {
      const nested = data.data as { results?: unknown }
      if (Array.isArray(nested.results)) return nested.results as T[]
    }
  }
  return []
}

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
  const [showJoinWorkshopModal, setShowJoinWorkshopModal] = useState(false)
  const [workshopFormData, setWorkshopFormData] = useState({ name: '', description: '' })
  const [creatingWorkshop, setCreatingWorkshop] = useState(false)
  const [joinWorkshopId, setJoinWorkshopId] = useState('')
  const [joiningWorkshop, setJoiningWorkshop] = useState(false)
  const [joinWorkshopError, setJoinWorkshopError] = useState('')
  const [joinWorkshopSuccess, setJoinWorkshopSuccess] = useState('')

  const refreshWorkshopList = async () => {
    try {
      const response = await apiClient.get('/workshops/me/')
      setWorkshops(response.data ? [response.data] : [])
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to load workshops:', error)
      }
      setWorkshops([])
    } finally {
      setWorkshopsLoading(false)
    }
  }

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
      void refreshWorkshopList()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      setTicketsLoading(true)
      apiClient.get(`/tickets/?assignee=${user.id}&limit=100`)
        .then((response) => {
          setTickets(unwrapListPayload<any>(response.data))
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

  const handleJoinWorkshop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinWorkshopId.trim()) {
      setJoinWorkshopError('Workshop ID is required')
      setJoinWorkshopSuccess('')
      return
    }

    setJoiningWorkshop(true)
    setJoinWorkshopError('')
    setJoinWorkshopSuccess('')
    try {
      await apiClient.post('/workshops/join/', {
        workshop_id: joinWorkshopId.trim(),
      })
      setJoinWorkshopSuccess('Joined workshop successfully')
      setJoinWorkshopId('')
      await refreshWorkshopList()
      setShowJoinWorkshopModal(false)
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        'Failed to join workshop'
      setJoinWorkshopError(message)
    } finally {
      setJoiningWorkshop(false)
    }
  }

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    const ws = connectWebSocket(token, (event) => {
      if (event.type === 'ticket.activity' && event.data?.action === 'assigned') {
        const d = event.data
        const actor: string = d.actor?.full_name ?? 'Someone'
        const assignee: string = d.assignee?.full_name ?? 'someone'
        const title: string = d.ticket_title ?? 'a ticket'
        notificationService.addNotification(
          `${actor} assigned "${title}" to ${assignee}`,
          'info',
        )
        setNotifications([...notificationService.getNotifications()])
      }
    })
    return () => ws.close()
  }, [])

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
    return undefined
  }, [showWorkshopModal])



  const TABS = [
    { id: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
    { id: 'tickets',   label: 'Tickets',   Icon: Ticket },
    { id: 'workshops', label: 'Workshops', Icon: Users },
    { id: 'reports',   label: 'Reports',   Icon: BarChart2 },
  ]
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-content">
          <Link to="/" className="logo-link">
            <img src="/resolveit-wordmark-white.svg" alt="ResolveIT" height={28} />
          </Link>
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

      <div className="dashboard-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`dashboard-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={13} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {label}
          </button>
        ))}
      </div>

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
              {user?.role?.toLowerCase() === 'technician' && (
                <button
                  className="create-workshop-btn"
                  onClick={() => {
                    setJoinWorkshopError('')
                    setJoinWorkshopSuccess('')
                    setShowJoinWorkshopModal(true)
                  }}
                >
                  Join Workshop
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
                      <p className="ticket-user">Workshop: {workshops[0]?.name || '—'}</p>
                      <p className="ticket-user">Last Updated: {new Date(ticket.updated_at).toLocaleDateString()}</p>
                      <p className="ticket-user">Status: {ticket.status}</p>
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
                    <p className={`status-badge status-${selectedTicket.status?.toLowerCase()}`}>
                      {selectedTicket.status}
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

          {showJoinWorkshopModal && (
            <div className="workshop-modal-overlay" onClick={() => setShowJoinWorkshopModal(false)}>
              <div className="workshop-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="workshop-modal-header">
                  <h2>Join Workshop</h2>
                  <button
                    className="workshop-modal-close"
                    onClick={() => setShowJoinWorkshopModal(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleJoinWorkshop}>
                  <div className="form-group">
                    <label htmlFor="workshop-id">Workshop ID</label>
                    <input
                      id="workshop-id"
                      type="text"
                      placeholder="Enter workshop ID"
                      value={joinWorkshopId}
                      onChange={(e) => setJoinWorkshopId(e.target.value)}
                      disabled={joiningWorkshop}
                      required
                    />
                  </div>
                  {joinWorkshopError ? <p className="workshop-feedback-error">{joinWorkshopError}</p> : null}
                  {joinWorkshopSuccess ? <p className="workshop-feedback-success">{joinWorkshopSuccess}</p> : null}
                  <div className="workshop-modal-footer">
                    <button
                      type="button"
                      className="modal-btn-cancel"
                      onClick={() => setShowJoinWorkshopModal(false)}
                      disabled={joiningWorkshop}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="modal-btn-create"
                      disabled={joiningWorkshop}
                    >
                      {joiningWorkshop ? 'Joining...' : 'Join Workshop'}
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
