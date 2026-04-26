import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Plus, Ticket } from 'lucide-react'
import apiClient from '@services/api'
import { getAccessToken, type AuthUser } from '@services/auth'
import '../styles/Tickets.css'

interface TicketUser {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  full_name: string
  role: string
}

interface TicketWorkbench {
  id: string
  name: string
  description: string
  color: string
  ticket_count: number
  created_at: string
}

interface TicketTag {
  name: string
}

interface TicketItem {
  id: string
  title: string
  description: string
  status: string
  urgency: string
  category: string
  asset_id: string
  resolution: string
  closed_at: string | null
  created_at: string
  updated_at: string
  requestor: TicketUser
  assignee: TicketUser | null
  workbench: TicketWorkbench
  tags: TicketTag[]
  work_log_count: number
}

interface WorkbenchOption {
  id: string
  name: string
  description: string
  color: string
}

interface MemberOption {
  id: string
  full_name: string
  username: string
  email: string
}

interface JwtPayload {
  workshop_id?: string | null
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded)) as JwtPayload
  } catch {
    return null
  }
}

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

const Tickets: React.FC = () => {
  const navigate = useNavigate()
  const token = getAccessToken()

  const [user, setUser] = useState<AuthUser | null>(null)
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [workbenches, setWorkbenches] = useState<WorkbenchOption[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    urgency: 'MEDIUM',
    category: '',
    asset_id: '',
    workbench_id: '',
    assignee_id: '',
  })

  const hasWorkshop = useMemo(() => {
    const payload = parseJwtPayload(token)
    return Boolean(payload?.workshop_id)
  }, [token])

  const canCreateTicket = Boolean(user?.role === 'OWNER' && hasWorkshop)

  const loadTickets = async (authUser: AuthUser, withWorkshop: boolean) => {
    const url = authUser.role === 'OWNER' && withWorkshop
      ? '/tickets/'
      : `/tickets/?assignee=${authUser.id}`
    const response = await apiClient.get(url)
    setTickets(unwrapListPayload<TicketItem>(response.data))
  }

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const boot = async () => {
      setLoading(true)
      setError('')
      try {
        const meResponse = await apiClient.get('/auth/me/')
        const authUser = meResponse.data as AuthUser
        setUser(authUser)

        await loadTickets(authUser, hasWorkshop)

        if (authUser.role === 'OWNER' && hasWorkshop) {
          const [workbenchResponse, membersResponse] = await Promise.all([
            apiClient.get('/workbenches/'),
            apiClient.get('/workshops/me/members/'),
          ])
          setWorkbenches(unwrapListPayload<WorkbenchOption>(workbenchResponse.data))
          setMembers(unwrapListPayload<MemberOption>(membersResponse.data))
        }
      } catch {
        setError('Failed to load tickets')
      } finally {
        setLoading(false)
      }
    }

    void boot()
  }, [navigate, token, hasWorkshop])

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canCreateTicket || creating) return

    if (!createForm.workbench_id || !createForm.assignee_id) {
      setCreateError('Workbench and assignee are required')
      return
    }

    setCreating(true)
    setCreateError('')

    try {
      const response = await apiClient.post('/tickets/', {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        urgency: createForm.urgency,
        category: createForm.category.trim(),
        asset_id: createForm.asset_id.trim(),
        workbench_id: createForm.workbench_id,
        assignee_id: createForm.assignee_id,
      })

      const nextTicket = response.data?.data?.ticket as TicketItem
      if (nextTicket) {
        setTickets((prev) => [nextTicket, ...prev])
      }

      setCreateForm({
        title: '',
        description: '',
        urgency: 'MEDIUM',
        category: '',
        asset_id: '',
        workbench_id: '',
        assignee_id: '',
      })
      setIsCreateOpen(false)
    } catch (createErr: any) {
      const data = createErr.response?.data
      setCreateError(
        data?.detail ||
        data?.workbench_id?.[0] ||
        data?.assignee_id?.[0] ||
        data?.title?.[0] ||
        'Failed to create ticket'
      )
    } finally {
      setCreating(false)
    }
  }

  const handleCompleteTicket = async (ticketId: string) => {
    if (completingId) return
    setCompletingId(ticketId)
    try {
      await apiClient.delete(`/tickets/${ticketId}/`)
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId))
      if (expandedTicketId === ticketId) setExpandedTicketId(null)
    } catch {
      // silent fail to avoid noisy UX
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <>
      <div className="tickets-page">
        <nav className="tickets-navbar">
          <div className="tickets-navbar-left">
            <Link to="/" className="logo-link" style={{ marginRight: '16px' }}>
              ResolveIT
            </Link>
            <button className="tickets-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={14} strokeWidth={1.75} />
              Dashboard
            </button>
            <h1 className="tickets-title">Tickets</h1>
          </div>

          <div className="tickets-navbar-right">
            {canCreateTicket ? (
              <button className="tickets-create-btn" onClick={() => { setCreateError(''); setIsCreateOpen(true) }}>
                <Plus size={14} strokeWidth={1.75} />
                Create Ticket
              </button>
            ) : null}
            <Link to="/" className="logo-link">
              ResolveIT
            </Link>
          </div>
        </nav>

        <div className="tickets-body">
          {!canCreateTicket ? (
            <div className="tickets-scope-note">Showing tickets assigned to you.</div>
          ) : null}

          {loading ? (
            <p className="tickets-message">Loading tickets...</p>
          ) : error ? (
            <p className="tickets-message">{error}</p>
          ) : tickets.length === 0 ? (
            <p className="tickets-message">No tickets found.</p>
          ) : (
            <div className="tickets-list">
              {tickets.map((ticket) => {
                const expanded = expandedTicketId === ticket.id
                return (
                  <div key={ticket.id} className={`ticket-card ${expanded ? 'expanded' : ''}`}>
                    <button
                      type="button"
                      className="ticket-summary"
                      onClick={() => setExpandedTicketId(expanded ? null : ticket.id)}
                    >
                      <div className="ticket-summary-main">
                        <span className="ticket-summary-title">{ticket.title}</span>
                        <span className="ticket-summary-meta">{ticket.workbench?.name || 'No workbench'}</span>
                      </div>
                      <div className="ticket-summary-right">
                        <span className={`ticket-chip ${ticket.status.toLowerCase().replace('_', '-')}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {expanded ? (
                      <div className="ticket-details">
                        <p><strong>Description:</strong> {ticket.description || '—'}</p>
                        <p><strong>Category:</strong> {ticket.category || '—'}</p>
                        <p><strong>Urgency:</strong> {ticket.urgency}</p>
                        <p><strong>Asset ID:</strong> {ticket.asset_id || '—'}</p>
                        <p><strong>Requestor:</strong> {ticket.requestor?.full_name || ticket.requestor?.email || '—'}</p>
                        <p><strong>Assignee:</strong> {ticket.assignee?.full_name || ticket.assignee?.email || '—'}</p>
                        <p><strong>Resolution:</strong> {ticket.resolution || '—'}</p>
                        <p><strong>Created:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
                        <p><strong>Updated:</strong> {new Date(ticket.updated_at).toLocaleString()}</p>

                        <div className="ticket-detail-actions">
                          <button
                            type="button"
                            className="ticket-complete-btn"
                            onClick={() => handleCompleteTicket(ticket.id)}
                            disabled={completingId === ticket.id}
                          >
                            <CheckCircle2 size={14} strokeWidth={1.75} />
                            {completingId === ticket.id ? 'Completing...' : 'Complete'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {isCreateOpen ? (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Ticket</h2>
              <button className="modal-close-btn" onClick={() => setIsCreateOpen(false)} aria-label="Close">✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="workshop-form">
              <div className="form-group">
                <label htmlFor="ticket_title">Title</label>
                <input
                  id="ticket_title"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket_description">Description</label>
                <textarea
                  id="ticket_description"
                  rows={3}
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket_category">Category</label>
                <input
                  id="ticket_category"
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                  required
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket_urgency">Urgency</label>
                <select
                  id="ticket_urgency"
                  value={createForm.urgency}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, urgency: event.target.value }))}
                  disabled={creating}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="ticket_asset_id">Asset ID</label>
                <input
                  id="ticket_asset_id"
                  value={createForm.asset_id}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, asset_id: event.target.value }))}
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket_workbench">Workbench</label>
                <select
                  id="ticket_workbench"
                  value={createForm.workbench_id}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, workbench_id: event.target.value }))}
                  required
                  disabled={creating}
                >
                  <option value="">Select a workbench</option>
                  {workbenches.map((workbench) => (
                    <option key={workbench.id} value={workbench.id}>{workbench.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="ticket_assignee">Assignee</label>
                <select
                  id="ticket_assignee"
                  value={createForm.assignee_id}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                  required
                  disabled={creating}
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name || member.username}</option>
                  ))}
                </select>
              </div>

              {createError ? <div className="error-message">{createError}</div> : null}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreateOpen(false)} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Tickets
