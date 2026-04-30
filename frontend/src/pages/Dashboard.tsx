import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  X, MessageSquare, Settings,
  AlertCircle, Clock, CheckCircle2, Users, Search,
  LayoutDashboard, Ticket as TicketIcon, Trophy,
} from 'lucide-react'
import apiClient from '@services/api'
import { clearAuthTokens, getAccessToken, getRefreshToken, type AuthUser } from '@services/auth'
import notificationService, { Notification } from '@services/notificationService'
import { connectWebSocket } from '@services/messagingService'
import Leaderboard from './Leaderboard'
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

const AVATAR_COLORS = ['#7048e8','#1971c2','#2f9e44','#f08c00','#c2255c','#0c8599','#5f3dc4','#e03131']

function workshopAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

function workshopInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getNotifications())
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
  const [onlineCount, setOnlineCount] = useState(0)

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

  useEffect(() => {
    if (user) {
      apiClient.get('/workshops/presence/')
        .then((res) => setOnlineCount(res.data.online_count ?? 0))
        .catch(() => {})
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
      setWorkshops([...workshops, response.data])
      setShowWorkshopModal(false)
      setWorkshopFormData({ name: '', description: '' })
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
      if (event.type === 'user.presence') {
        const action = event.data?.action
        if (action === 'online')  setOnlineCount(c => c + 1)
        else if (action === 'offline') setOnlineCount(c => Math.max(0, c - 1))
      }
    })
    return () => ws.close()
  }, [])

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
    { id: 'overview',     label: 'Overview',     Icon: LayoutDashboard },
    { id: 'tickets',      label: 'Tickets',      Icon: TicketIcon },
    { id: 'workshops',    label: 'Workshops',    Icon: Users },
    { id: 'leaderboard',  label: 'Leaderboard',  Icon: Trophy },
  ]
  const [activeTab, setActiveTab] = useState('overview')

  const unreadCount = notifications.filter(n => !n.read).length
  const openTickets = tickets.filter(
    t => !['closed', 'resolved'].includes((t.status || '').toLowerCase())
  ).length
  const resolved7d = tickets.filter(t => {
    const isResolved = ['closed', 'resolved'].includes((t.status || '').toLowerCase())
    const recent = new Date(t.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return isResolved && recent
  }).length
  const urgentCount = tickets.filter(
    t => ['high', 'urgent', 'critical'].includes((t.urgency || '').toLowerCase())
      && !['closed', 'resolved'].includes((t.status || '').toLowerCase())
  ).length
  const userInitials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase()
    : '?'

  const workshopsSection = (
    <section className="dash-section">
      <div className="section-header">
        <h2 className="section-title">Your Workshops</h2>
        {user?.role?.toLowerCase() === 'owner' && (
          <button className="create-workshop-btn" onClick={() => setShowWorkshopModal(true)}>
            + New Workshop
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
        <p className="dash-loading">Loading workshops…</p>
      ) : workshops.length === 0 ? (
        <p className="empty-workshops">You are not in any workshops yet.</p>
      ) : (
        <div className="workshop-cards-grid">
          {workshops.map((workshop) => (
            <div key={workshop.id} className="workshop-card">
              <div className="workshop-card-left">
                <div
                  className="workshop-card-avatar"
                  style={{ background: workshopAvatarColor(workshop.name || 'W') }}
                >
                  {workshopInitials(workshop.name || 'Workshop')}
                </div>
                <div className="workshop-card-body">
                  <div className="workshop-card-name">{workshop.name}</div>
                  <div className="workshop-card-desc">
                    {workshop.description || 'No description provided.'}
                  </div>
                  <div className="workshop-card-chips">
                    <span className="workshop-chip workshop-chip-open">
                      {workshop.open_ticket_count ?? 0} open
                    </span>
                    <span className="workshop-chip workshop-chip-members">
                      {workshop.member_count ?? (workshop.members?.length ?? 1)} members
                    </span>
                  </div>
                </div>
              </div>
              <div className="workshop-card-right">
                {Array.isArray(workshop.members) && workshop.members.length > 0 && (
                  <div className="workshop-member-stack">
                    {workshop.members.slice(0, 4).map((m: any, i: number) => (
                      <span
                        key={i}
                        className="workshop-member-avatar"
                        title={`${m.first_name || ''} ${m.last_name || ''}`.trim()}
                      >
                        {(m.first_name?.[0] || '?') + (m.last_name?.[0] || '')}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  className="workshop-enter-btn"
                  onClick={() => navigate('/workshop')}
                >
                  Enter →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  const ticketsSection = (
    <section className="dash-section">
      <div className="section-header">
        <h2 className="section-title">Your Tickets</h2>
      </div>
      {ticketsLoading ? (
        <p className="dash-loading">Loading tickets…</p>
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
  )

  return (
    <div className="dashboard-container">
      {/* ── Top Nav ── */}
      <nav className="dash-nav">
        <div className="dash-nav-inner">
          <div className="dash-nav-left">
            <Link to="/" className="dash-logo">
              <img src="/resolveit-mark.svg" alt="ResolveIT" width={28} height={28} />
              <span className="dash-logo-text">
                <span className="dash-logo-white">Resolve</span>
                <span className="dash-logo-red">IT</span>
              </span>
            </Link>
          </div>

          <div className="dash-nav-center">
            <div className="dash-tabs">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`dash-tab${activeTab === id ? ' active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="dash-nav-right">
            <div className="dash-search">
              <Search size={14} className="dash-search-icon" />
              <input
                type="text"
                placeholder="Search anything..."
                className="dash-search-input"
                readOnly
              />
              <kbd className="dash-kbd">⌘K</kbd>
            </div>
            <div className="dash-avatar-wrap">
              <button
                className="dash-avatar"
                onClick={() => setMenuOpen(!menuOpen)}
                title={user ? `${user.first_name} ${user.last_name}` : ''}
              >
                {userInitials}
              </button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <MessageSquare size={16} strokeWidth={1.75} />
                    <span>Messages</span>
                  </button>
                  <button className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <Settings size={16} strokeWidth={1.75} />
                    <span>Settings</span>
                  </button>
                  <div className="dropdown-divider" />
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

      {/* ── Page Content ── */}
      <main className="dash-main">

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            <div className="dash-welcome">
              <h1 className="dash-welcome-heading">Welcome back, {user?.first_name}.</h1>
              <p className="dash-welcome-sub">
                You have{' '}
                <span className="urgent-count">{urgentCount} urgent tickets</span>
                {' '}and {unreadCount} unread mentions across {workshops.length} workshops.
              </p>
            </div>

            <div className="dash-stats">
              <div className="stat-card">
                <div className="stat-label">
                  <AlertCircle size={13} />
                  Open Tickets
                </div>
                <div className="stat-value">{openTickets}</div>
                <div className={`stat-delta ${openTickets > 0 ? 'up' : 'down'}`}>
                  {openTickets > 0 ? `↑ ${openTickets} active` : '↓ all clear'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <Clock size={13} />
                  Avg Resolution
                </div>
                <div className="stat-value">—</div>
                <div className="stat-delta neutral">no data available</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <CheckCircle2 size={13} />
                  Resolved (7d)
                </div>
                <div className="stat-value">{resolved7d}</div>
                <div className={`stat-delta ${resolved7d > 0 ? 'down' : 'neutral'}`}>
                  {resolved7d > 0 ? `↓ ${resolved7d} closed` : 'none this week'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <Users size={13} />
                  Online Now
                </div>
                <div className="stat-value">{onlineCount}</div>
                <div className={`stat-delta ${onlineCount > 0 ? 'down' : 'neutral'}`}>
                  {onlineCount > 0 ? `↓ ${onlineCount} active` : '— no one online'}
                </div>
              </div>
            </div>

            {workshopsSection}
            {ticketsSection}
          </>
        )}

        {/* Tickets */}
        {activeTab === 'tickets' && ticketsSection}

        {/* Workshops */}
        {activeTab === 'workshops' && workshopsSection}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && <Leaderboard user={user} />}

        {/* ── Ticket Detail Modal ── */}
        {selectedTicket && (
          <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Ticket Details</h2>
                <button className="modal-close" onClick={() => setSelectedTicket(null)}>
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
                <button className="modal-btn" onClick={() => navigate('/tickets')}>
                  Go to Tickets
                </button>
                <button className="modal-btn modal-btn-close" onClick={() => setSelectedTicket(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Workshop Modal ── */}
        {showWorkshopModal && (
          <div className="workshop-modal-overlay" onClick={() => setShowWorkshopModal(false)}>
            <div className="workshop-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="workshop-modal-header">
                <h2>Create Workshop</h2>
                <button className="workshop-modal-close" onClick={() => setShowWorkshopModal(false)}>
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
                    {creatingWorkshop ? 'Creating…' : 'Create Workshop'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Join Workshop Modal ── */}
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
                {joinWorkshopError && <p className="workshop-feedback-error">{joinWorkshopError}</p>}
                {joinWorkshopSuccess && <p className="workshop-feedback-success">{joinWorkshopSuccess}</p>}
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
                    {joiningWorkshop ? 'Joining…' : 'Join Workshop'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default Dashboard
