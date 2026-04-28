import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react'
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
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [savingTicket, setSavingTicket] = useState(false)
  const [editError, setEditError] = useState('')
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    urgency: 'MEDIUM',
    category: '',
    asset_id: '',
    workbench_id: '',
    assignee_id: '',
  })
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'OPEN',
    urgency: 'MEDIUM',
    category: '',
    asset_id: '',
    resolution: '',
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

  const handleOpenTicket = (ticket: TicketItem) => {
    setEditError('')
    setSelectedTicket(ticket)
    setEditForm({
      title: ticket.title || '',
      description: ticket.description || '',
      status: ticket.status || 'OPEN',
      urgency: ticket.urgency || 'MEDIUM',
      category: ticket.category || '',
      asset_id: ticket.asset_id || '',
      resolution: ticket.resolution || '',
      assignee_id: ticket.assignee?.id || '',
    })
  }

  const handleSaveTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedTicket || savingTicket) return

    if (
      (editForm.status === 'RESOLVED' || editForm.status === 'CLOSED') &&
      !editForm.resolution.trim()
    ) {
      setEditError('Resolution is required when status is RESOLVED or CLOSED')
      return
    }

    setSavingTicket(true)
    setEditError('')
    try {
      const response = await apiClient.patch(`/tickets/${selectedTicket.id}/`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
        urgency: editForm.urgency,
        category: editForm.category.trim(),
        asset_id: editForm.asset_id.trim(),
        resolution: editForm.resolution.trim(),
        assignee_id: editForm.assignee_id || null,
      })

      const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data) as TicketItem
      const ticketId = patchedTicket?.id || selectedTicket.id
      const detailResponse = await apiClient.get(`/tickets/${ticketId}/`)
      const persistedTicket = detailResponse.data as TicketItem

      if (persistedTicket?.id) {
        setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)))
        setSelectedTicket(null)
      }
    } catch (saveErr: any) {
      const data = saveErr.response?.data
      setEditError(
        data?.detail ||
        data?.message ||
        data?.title?.[0] ||
        data?.description?.[0] ||
        data?.status?.[0] ||
        data?.urgency?.[0] ||
        data?.category?.[0] ||
        data?.asset_id?.[0] ||
        data?.assignee_id?.[0] ||
        data?.resolution?.[0] ||
        'Failed to update ticket'
      )
    } finally {
      setSavingTicket(false)
    }
  }

  const handleCompleteTicket = async (ticketId: string) => {
    if (completingId) return
    setCompletingId(ticketId)
    try {
      const response = await apiClient.patch(`/tickets/${ticketId}/`, { status: 'CLOSED' })
      const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data) as TicketItem
      const persistedId = patchedTicket?.id || ticketId
      const detailResponse = await apiClient.get(`/tickets/${persistedId}/`)
      const persistedTicket = detailResponse.data as TicketItem
      if (persistedTicket?.id) {
        setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)))
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(persistedTicket)
          setEditForm((prev) => ({ ...prev, status: persistedTicket.status }))
        }
      }
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
                return (
                  <div key={ticket.id} className="ticket-card">
                    <button
                      type="button"
                      className="ticket-summary"
                      onClick={() => handleOpenTicket(ticket)}
                    >
                      <div className="ticket-summary-main">
                        <span className="ticket-summary-title">{ticket.title}</span>
                        <span className="ticket-summary-meta">{ticket.workbench?.name || 'No workbench'}</span>
                      </div>
                      <div className="ticket-summary-right">
                        <span className={`ticket-chip ${ticket.status.toLowerCase().replace('_', '-')}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTicket ? (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Ticket</h2>
              <button className="modal-close-btn" onClick={() => setSelectedTicket(null)} aria-label="Close">✕</button>
            </div>

            <form onSubmit={handleSaveTicket} className="workshop-form">
              <div className="form-group">
                <label htmlFor="edit_ticket_title">Title</label>
                <input
                  id="edit_ticket_title"
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_description">Description</label>
                <textarea
                  id="edit_ticket_description"
                  rows={3}
                  value={editForm.description}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_status">Status</label>
                <select
                  id="edit_ticket_status"
                  value={editForm.status}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                  {editForm.status === 'CLOSED'
                    ? 'Status: CLOSED (ticket is retained; it is not deleted).'
                    : `Status: ${editForm.status}`}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_urgency">Urgency</label>
                <select
                  id="edit_ticket_urgency"
                  value={editForm.urgency}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, urgency: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_category">Category</label>
                <input
                  id="edit_ticket_category"
                  value={editForm.category}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_asset_id">Asset ID</label>
                <input
                  id="edit_ticket_asset_id"
                  value={editForm.asset_id}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, asset_id: event.target.value }))}
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_assignee">Assignee</label>
                <select
                  id="edit_ticket_assignee"
                  value={editForm.assignee_id}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name || member.username}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_ticket_resolution">Resolution</label>
                <textarea
                  id="edit_ticket_resolution"
                  rows={3}
                  value={editForm.resolution}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, resolution: event.target.value }))}
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label>Created</label>
                <input value={new Date(selectedTicket.created_at).toLocaleString()} disabled />
              </div>

              <div className="form-group">
                <label>Updated</label>
                <input value={new Date(selectedTicket.updated_at).toLocaleString()} disabled />
              </div>

              {editError ? <div className="error-message">{editError}</div> : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="ticket-complete-btn"
                  onClick={() => handleCompleteTicket(selectedTicket.id)}
                  disabled={completingId === selectedTicket.id || savingTicket}
                >
                  <CheckCircle2 size={14} strokeWidth={1.75} />
                  {completingId === selectedTicket.id ? 'Closing...' : 'Mark Closed'}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setSelectedTicket(null)} disabled={savingTicket}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={savingTicket}>
                  {savingTicket ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
