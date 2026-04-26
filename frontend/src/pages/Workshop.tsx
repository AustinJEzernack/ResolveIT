import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Send, Ticket, UserPlus } from 'lucide-react'
import CreateWorkshopModal from '../components/CreateWorkshopModal'
import apiClient from '@services/api'
import {
  connectWebSocket,
  createChannel,
  fetchChannels,
  fetchMessages,
  fetchTickets,
  fetchWorkbenches,
  joinChannel,
  leaveChannel,
  postMessage,
  type Channel,
  type ChatMessage,
  type TicketItem,
  type Workbench,
} from '@services/messagingService'
import '../styles/Workshop.css'

interface WorkshopSummary {
  id: string
  name: string
  slug: string
  description: string
  logo_url: string | null
  member_count: number
  workbench_count: number
  created_at: string
}

interface WorkshopMember {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  avatar_url: string | null
}

function unwrapListPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const data = payload as { data?: unknown; results?: unknown }
    if (Array.isArray(data.data)) return data.data as T[]
    if (Array.isArray(data.results)) return data.results as T[]
  }
  return []
}

const Workshop: React.FC = () => {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token') ?? ''

  const [workshop, setWorkshop] = useState<WorkshopSummary | null>(null)
  const [currentRole, setCurrentRole] = useState('')
  const [workbenches, setWorkbenches] = useState<Workbench[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [availableMembers, setAvailableMembers] = useState<WorkshopMember[]>([])
  const [activeWorkbenchId, setActiveWorkbenchId] = useState<string | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [input, setInput] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreateWorkbenchOpen, setIsCreateWorkbenchOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null)
  const [workbenchForm, setWorkbenchForm] = useState({
    name: '',
    description: '',
    color: '#e03131',
  })
  const [creatingWorkbench, setCreatingWorkbench] = useState(false)
  const [createWorkbenchError, setCreateWorkbenchError] = useState('')
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [createTicketError, setCreateTicketError] = useState('')
  const [workshopMembers, setWorkshopMembers] = useState<WorkshopMember[]>([])
  const [workshopMembersLoading, setWorkshopMembersLoading] = useState(false)
  const [createTicketForm, setCreateTicketForm] = useState({
    title: '',
    description: '',
    urgency: 'MEDIUM',
    category: '',
    asset_id: '',
    assignee_id: '',
  })
  const [savingTicket, setSavingTicket] = useState(false)
  const [editTicketError, setEditTicketError] = useState('')
  const [editTicketForm, setEditTicketForm] = useState({
    title: '',
    description: '',
    status: 'OPEN',
    urgency: 'MEDIUM',
    category: '',
    asset_id: '',
    resolution: '',
    assignee_id: '',
  })

  const wsRef = useRef<WebSocket | null>(null)
  const prevChannelRef = useRef<string | null>(null)
  const activeChannelIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const loadWorkbenchState = async () => {
    try {
      const [nextWorkbenches, nextChannels] = await Promise.all([
        fetchWorkbenches(),
        fetchChannels(),
      ])
      setWorkbenches(nextWorkbenches)
      setChannels(nextChannels)
      setActiveWorkbenchId((currentId) => {
        if (currentId && nextWorkbenches.some((workbench) => workbench.id === currentId)) {
          return currentId
        }
        return nextWorkbenches[0]?.id ?? null
      })
    } catch {
      setWorkbenches([])
      setChannels([])
      setActiveWorkbenchId(null)
    }
  }

  const loadWorkshopMeta = async () => {
    const [workshopResult, meResult] = await Promise.allSettled([
      apiClient.get('/workshops/me/'),
      apiClient.get('/auth/me/'),
    ])

    if (workshopResult.status === 'fulfilled') {
      setWorkshop(workshopResult.value.data as WorkshopSummary)
    } else {
      setWorkshop(null)
    }

    if (meResult.status === 'fulfilled') {
      const me = meResult.value.data
      setCurrentRole(me?.role ?? '')
      setCurrentUserId(me?.id ?? '')
    } else {
      setCurrentRole('')
      setCurrentUserId('')
    }
  }

  const refreshWorkshopPage = async () => {
    await Promise.all([loadWorkbenchState(), loadWorkshopMeta()])
  }

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    void refreshWorkshopPage().finally(() => setLoading(false))

    const ws = connectWebSocket(token, (event) => {
      if (event.type === 'message.new') {
        const newMsg = event.data as ChatMessage
        if (newMsg.channel_id === activeChannelIdRef.current) {
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
          )
        }
      }
    })
    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeWorkbenchId) {
      setTickets([])
      setActiveChannelId(null)
      return
    }

    fetchTickets(activeWorkbenchId).then(setTickets).catch(() => {
      setTickets([])
    })

    const workbench = workbenches.find((item) => item.id === activeWorkbenchId)
    const match = channels.find((channel) => channel.name === workbench?.name)

    if (match) {
      setActiveChannelId(match.id)
    } else if (workbench && !creatingChannel) {
      // Auto-create a channel for this workbench (owner: via API; others wait for owner to create it)
      setCreatingChannel(true)
      const fetchAndCreate = async () => {
        try {
          const res = await apiClient.get('/workshops/me/members/')
          const allMembers: WorkshopMember[] = unwrapListPayload<WorkshopMember>(res.data)
          const otherMemberIds = allMembers
            .filter((m) => m.id !== currentUserId)
            .map((m) => m.id)
          const newChannel = await createChannel(workbench.name, otherMemberIds)
          if (newChannel) {
            const updatedChannels = await fetchChannels()
            setChannels(updatedChannels)
            setActiveChannelId(newChannel.id)
          }
        } catch {
          setActiveChannelId(null)
          setMessages([])
        } finally {
          setCreatingChannel(false)
        }
      }
      void fetchAndCreate()
    } else if (!workbench) {
      setActiveChannelId(null)
      setMessages([])
    }
  }, [activeWorkbenchId, workbenches, channels]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId
  }, [activeChannelId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([])
      return
    }

    const ws = wsRef.current
    if (ws && prevChannelRef.current) {
      leaveChannel(ws, prevChannelRef.current)
    }

    fetchMessages(activeChannelId).then(setMessages).catch(() => setMessages([]))

    if (ws) {
      const doJoin = () => joinChannel(ws, activeChannelId)
      if (ws.readyState === WebSocket.OPEN) {
        doJoin()
      } else {
        ws.addEventListener('open', doJoin, { once: true })
      }
    }

    prevChannelRef.current = activeChannelId
  }, [activeChannelId])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !activeChannelId || sending) return
    setInput('')
    setSending(true)
    try {
      const msg = await postMessage(activeChannelId, text)
      setMessages((prev) => [...prev, msg])
    } catch {
      // failed silently
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSend()
  }

  const handleOpenInviteModal = async () => {
    setIsInviteOpen(true)
    setInviteError('')
    setInviteSuccess('')
    setMemberSearch('')
    setInviteLoading(true)

    try {
      const response = await apiClient.get('/workshops/available-members/')
      setAvailableMembers(unwrapListPayload<WorkshopMember>(response.data))
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to load available members'
      setInviteError(message)
      setAvailableMembers([])
    } finally {
      setInviteLoading(false)
    }
  }

  const handleAddMember = async (member: WorkshopMember) => {
    if (addingMemberId) return

    setInviteError('')
    setInviteSuccess('')
    setAddingMemberId(member.id)

    try {
      await apiClient.post(`/workshops/me/members/${member.id}/assign/`)
      setAvailableMembers((prev) => prev.filter((item) => item.id !== member.id))
      setInviteSuccess(`${member.full_name || member.email} added to ${workshop?.name ?? 'your workshop'}.`)
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to add member to workshop'
      setInviteError(message)
    } finally {
      setAddingMemberId(null)
    }
  }

  const handleCreateWorkbench = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = workbenchForm.name.trim()
    if (!trimmedName || creatingWorkbench) return

    setCreateWorkbenchError('')
    setCreatingWorkbench(true)

    try {
      await apiClient.post('/workbenches/', {
        name: trimmedName,
        description: workbenchForm.description.trim(),
        color: workbenchForm.color || '',
      })

      setWorkbenchForm({ name: '', description: '', color: '#e03131' })
      setIsCreateWorkbenchOpen(false)
      await loadWorkbenchState()
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.name?.[0] ||
        error.response?.data?.message ||
        'Failed to create workbench'
      setCreateWorkbenchError(message)
    } finally {
      setCreatingWorkbench(false)
    }
  }

  const handleOpenCreateTicket = async () => {
    setCreateTicketError('')
    setCreateTicketForm({ title: '', description: '', urgency: 'MEDIUM', category: '', asset_id: '', assignee_id: '' })
    setIsCreateTicketOpen(true)
    if (workshopMembers.length === 0) {
      setWorkshopMembersLoading(true)
      try {
        const res = await apiClient.get('/workshops/me/members/')
        setWorkshopMembers(unwrapListPayload<WorkshopMember>(res.data))
      } catch {
        // leave empty
      } finally {
        setWorkshopMembersLoading(false)
      }
    }
  }

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeWorkbenchId || creatingTicket) return
    if (!createTicketForm.assignee_id) {
      setCreateTicketError('Assignee is required')
      return
    }
    setCreatingTicket(true)
    setCreateTicketError('')
    try {
      await apiClient.post('/tickets/', {
        title: createTicketForm.title.trim(),
        description: createTicketForm.description.trim(),
        urgency: createTicketForm.urgency,
        category: createTicketForm.category.trim(),
        asset_id: createTicketForm.asset_id.trim(),
        workbench_id: activeWorkbenchId,
        assignee_id: createTicketForm.assignee_id,
      })
      setIsCreateTicketOpen(false)
      fetchTickets(activeWorkbenchId).then(setTickets).catch(() => {})
    } catch (err: any) {
      const data = err.response?.data
      setCreateTicketError(
        data?.detail ||
        data?.workbench_id?.[0] ||
        data?.assignee_id?.[0] ||
        data?.title?.[0] ||
        'Failed to create ticket'
      )
    } finally {
      setCreatingTicket(false)
    }
  }

  const handleOpenTicket = async (ticket: TicketItem) => {
    setEditTicketError('')
    setSelectedTicket(ticket)
    setEditTicketForm({
      title: ticket.title || '',
      description: ticket.description || '',
      status: ticket.status || 'OPEN',
      urgency: ticket.urgency || 'MEDIUM',
      category: ticket.category || '',
      asset_id: ticket.asset_id || '',
      resolution: ticket.resolution || '',
      assignee_id: ticket.assignee?.id || '',
    })

    if (workshopMembers.length === 0) {
      setWorkshopMembersLoading(true)
      try {
        const res = await apiClient.get('/workshops/me/members/')
        setWorkshopMembers(unwrapListPayload<WorkshopMember>(res.data))
      } catch {
        // leave empty
      } finally {
        setWorkshopMembersLoading(false)
      }
    }
  }

  const handleSaveTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedTicket || savingTicket) return

    if (
      (editTicketForm.status === 'RESOLVED' || editTicketForm.status === 'CLOSED') &&
      !editTicketForm.resolution.trim()
    ) {
      setEditTicketError('Resolution is required when status is RESOLVED or CLOSED')
      return
    }

    setSavingTicket(true)
    setEditTicketError('')
    try {
      const response = await apiClient.patch(`/tickets/${selectedTicket.id}/`, {
        title: editTicketForm.title.trim(),
        description: editTicketForm.description.trim(),
        status: editTicketForm.status,
        urgency: editTicketForm.urgency,
        category: editTicketForm.category.trim(),
        asset_id: editTicketForm.asset_id.trim(),
        resolution: editTicketForm.resolution.trim(),
        assignee_id: editTicketForm.assignee_id || null,
      })

      const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data) as TicketItem
      const ticketId = patchedTicket?.id || selectedTicket.id
      const detailResponse = await apiClient.get(`/tickets/${ticketId}/`)
      const persistedTicket = detailResponse.data as TicketItem

      if (persistedTicket?.id) {
        setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)))
        setSelectedTicket(null)
      }
    } catch (err: any) {
      const data = err.response?.data
      setEditTicketError(
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

  const activeWorkbench = workbenches.find((workbench) => workbench.id === activeWorkbenchId)
  const canCreateWorkbenches = Boolean(workshop && currentRole === 'OWNER')
  const canInviteMembers = Boolean(workshop && currentRole === 'OWNER')
  const filteredMembers = availableMembers.filter((member) => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return true
    return [member.username, member.full_name, member.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  return (
    <>
      <div className="workshop-page">
        <nav className="workshop-navbar">
          <div className="workshop-navbar-left">
            <Link to="/" className="logo-link" style={{ marginRight: '16px' }}>
              ResolveIT
            </Link>
            <button className="workshop-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={14} strokeWidth={1.75} />
              Dashboard
            </button>
            <h1 className="workshop-title">My Workshop</h1>
          </div>

          <div className="workshop-navbar-right">
            {canCreateWorkbenches ? (
              <button
                className="workshop-action-btn"
                onClick={() => {
                  setCreateWorkbenchError('')
                  setIsCreateWorkbenchOpen(true)
                }}
                title="Create a workbench"
              >
                <Plus size={14} strokeWidth={1.75} />
                Create Workbench
              </button>
            ) : null}
            <button
              className="workshop-action-btn"
              onClick={handleOpenInviteModal}
              disabled={!canInviteMembers}
              title={canInviteMembers ? 'Invite a member' : 'Only workshop owners can invite members'}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              Invite Member
            </button>
            <span className="logo-link">ResolveIT</span>
          </div>
        </nav>

        {loading ? (
          <div className="workshop-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--fg-muted)' }}>Loading...</p>
          </div>
        ) : (
          <div className="workshop-body">
            <aside className="workshop-sidebar">
              <div className="workshop-sidebar-header">Workbenches</div>
              {workbenches.length === 0 ? (
                <p style={{ padding: '12px', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                  {workshop ? 'No workbenches yet.' : 'Create a workshop to get started.'}
                </p>
              ) : (
                workbenches.map((workbench) => (
                  <div
                    key={workbench.id}
                    className={`workbench-item ${workbench.id === activeWorkbenchId ? 'active' : ''}`}
                    onClick={() => setActiveWorkbenchId(workbench.id)}
                  >
                    <span className="workbench-dot" style={{ backgroundColor: workbench.color || '#888' }} />
                    {workbench.name}
                  </div>
                ))
              )}
            </aside>

            <div className="workshop-middle">
              <div className="workshop-middle-header">
                <Ticket size={15} strokeWidth={1.75} style={{ color: 'var(--fg-muted)' }} />
                <h2>{activeWorkbench?.name ?? workshop?.name ?? 'Workbench'}</h2>
                {activeWorkbenchId ? (
                  <button
                    className="workshop-action-btn"
                    onClick={handleOpenCreateTicket}
                    title="Create a ticket in this workbench"
                  >
                    <Plus size={14} strokeWidth={1.75} />
                    Create Ticket
                  </button>
                ) : null}
              </div>

              <div className="workshop-tickets">
                {tickets.length === 0 ? (
                  <p style={{ color: 'var(--fg-muted)', padding: '8px 0', fontSize: '0.85rem' }}>
                    No tickets in this workbench.
                  </p>
                ) : (
                  tickets.map((ticket) => {
                    const assigneeLabel = ticket.assignee?.full_name || ticket.assignee?.email || 'Unassigned'

                    return (
                      <div key={ticket.id} className="ticket-card-inline">
                        <button
                          type="button"
                          className="ticket-row"
                          onClick={() => void handleOpenTicket(ticket)}
                        >
                          <span className="ticket-id">{String(ticket.id).slice(0, 8)}</span>
                          <span className="ticket-title">{ticket.title}</span>
                          <span className="ticket-assignee">{assigneeLabel}</span>
                          <span className={`ticket-status ${ticket.status.toLowerCase().replace('_', '-')}`}>
                            {ticket.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="workshop-chat">
                {activeChannelId ? (
                  <>
                    <div className="chat-messages">
                      {messages.map((message) => {
                        const initials = `${message.sender.first_name?.[0] ?? ''}${message.sender.last_name?.[0] ?? ''}`.toUpperCase()
                        return (
                          <div key={message.id} className="chat-message">
                            <div className="chat-avatar">{initials || '?'}</div>
                            <div className="chat-bubble">
                              <div className="chat-sender">
                                {message.sender.full_name}
                                <span className="chat-timestamp">
                                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="chat-text">{message.content}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="chat-input-row">
                      <input
                        className="chat-input"
                        placeholder={`Message ${activeWorkbench?.name ?? 'workbench'}...`}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                      />
                      <button className="chat-send-btn" onClick={handleSend} disabled={sending}>
                        <Send size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div style={{ padding: '16px', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                    {creatingChannel ? 'Setting up channel…' : 'No channel linked to this workbench.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateWorkshopModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          void refreshWorkshopPage()
        }}
      />

      {isCreateWorkbenchOpen ? (
        <div className="modal-overlay" onClick={() => setIsCreateWorkbenchOpen(false)}>
          <div className="modal-content workshop-create-workbench-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Workbench</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateWorkbenchOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkbench} className="workshop-form">
              <div className="form-group">
                <label htmlFor="workbench_name">Name</label>
                <input
                  id="workbench_name"
                  name="workbench_name"
                  type="text"
                  value={workbenchForm.name}
                  onChange={(event) => setWorkbenchForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="General Support"
                  required
                  disabled={creatingWorkbench}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workbench_description">Description</label>
                <textarea
                  id="workbench_description"
                  name="workbench_description"
                  value={workbenchForm.description}
                  onChange={(event) => setWorkbenchForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  disabled={creatingWorkbench}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workbench_color">Color</label>
                <input
                  id="workbench_color"
                  name="workbench_color"
                  type="text"
                  value={workbenchForm.color}
                  onChange={(event) => setWorkbenchForm((prev) => ({ ...prev, color: event.target.value }))}
                  placeholder="#e03131"
                  disabled={creatingWorkbench}
                />
              </div>

              {createWorkbenchError ? <div className="error-message">{createWorkbenchError}</div> : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsCreateWorkbenchOpen(false)}
                  disabled={creatingWorkbench}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={creatingWorkbench || !workbenchForm.name.trim()}
                >
                  {creatingWorkbench ? 'Creating...' : 'Create Workbench'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateTicketOpen ? (
        <div className="modal-overlay" onClick={() => setIsCreateTicketOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Ticket — {activeWorkbench?.name}</h2>
              <button className="modal-close-btn" onClick={() => setIsCreateTicketOpen(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleCreateTicket} className="workshop-form">
              <div className="form-group">
                <label htmlFor="ticket_title">Title</label>
                <input
                  id="ticket_title"
                  value={createTicketForm.title}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  disabled={creatingTicket}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ticket_description">Description</label>
                <textarea
                  id="ticket_description"
                  rows={3}
                  value={createTicketForm.description}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                  disabled={creatingTicket}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ticket_category">Category</label>
                <input
                  id="ticket_category"
                  value={createTicketForm.category}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, category: event.target.value }))}
                  required
                  disabled={creatingTicket}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ticket_urgency">Urgency</label>
                <select
                  id="ticket_urgency"
                  value={createTicketForm.urgency}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, urgency: event.target.value }))}
                  disabled={creatingTicket}
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
                  value={createTicketForm.asset_id}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, asset_id: event.target.value }))}
                  disabled={creatingTicket}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ticket_assignee">Assignee</label>
                <select
                  id="ticket_assignee"
                  value={createTicketForm.assignee_id}
                  onChange={(event) => setCreateTicketForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                  required
                  disabled={creatingTicket || workshopMembersLoading}
                >
                  <option value="">{workshopMembersLoading ? 'Loading...' : 'Select a member'}</option>
                  {workshopMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name || member.username}</option>
                  ))}
                </select>
              </div>
              {createTicketError ? <div className="error-message">{createTicketError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreateTicketOpen(false)} disabled={creatingTicket}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={creatingTicket}>
                  {creatingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedTicket ? (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Ticket</h2>
              <button className="modal-close-btn" onClick={() => setSelectedTicket(null)} aria-label="Close">✕</button>
            </div>

            <form onSubmit={handleSaveTicket} className="workshop-form">
              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_title">Title</label>
                <input
                  id="workshop_edit_ticket_title"
                  value={editTicketForm.title}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_description">Description</label>
                <textarea
                  id="workshop_edit_ticket_description"
                  rows={3}
                  value={editTicketForm.description}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_status">Status</label>
                <select
                  id="workshop_edit_ticket_status"
                  value={editTicketForm.status}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, status: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                  {editTicketForm.status === 'CLOSED'
                    ? 'Status: CLOSED (ticket is retained; it is not deleted).'
                    : `Status: ${editTicketForm.status}`}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_urgency">Urgency</label>
                <select
                  id="workshop_edit_ticket_urgency"
                  value={editTicketForm.urgency}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, urgency: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_category">Category</label>
                <input
                  id="workshop_edit_ticket_category"
                  value={editTicketForm.category}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, category: event.target.value }))}
                  required
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_asset_id">Asset ID</label>
                <input
                  id="workshop_edit_ticket_asset_id"
                  value={editTicketForm.asset_id}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, asset_id: event.target.value }))}
                  disabled={savingTicket}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_assignee">Assignee</label>
                <select
                  id="workshop_edit_ticket_assignee"
                  value={editTicketForm.assignee_id}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                  disabled={savingTicket || workshopMembersLoading}
                >
                  <option value="">Unassigned</option>
                  {workshopMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name || member.username}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="workshop_edit_ticket_resolution">Resolution</label>
                <textarea
                  id="workshop_edit_ticket_resolution"
                  rows={3}
                  value={editTicketForm.resolution}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, resolution: event.target.value }))}
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

              {editTicketError ? <div className="error-message">{editTicketError}</div> : null}

              <div className="modal-actions">
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

      {isInviteOpen ? (
        <div className="modal-overlay" onClick={() => setIsInviteOpen(false)}>
          <div className="modal-content workshop-invite-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Invite Members</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsInviteOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="workshop-form">
              <div className="workshop-member-search">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by username, name, or email"
                  disabled={inviteLoading}
                />
              </div>

              {inviteError ? <div className="error-message">{inviteError}</div> : null}
              {inviteSuccess ? <div className="workshop-success-message">{inviteSuccess}</div> : null}

              <div className="workshop-member-list">
                {inviteLoading ? (
                  <p className="workshop-member-empty">Loading members...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="workshop-member-empty">
                    {availableMembers.length === 0 ? 'No available members to add.' : 'No members match your search.'}
                  </p>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="workshop-member-item"
                      onClick={() => handleAddMember(member)}
                      disabled={addingMemberId === member.id}
                    >
                      <div className="workshop-member-copy">
                        <span className="workshop-member-name">{member.full_name || member.username}</span>
                        <span className="workshop-member-username">@{member.username}</span>
                        <span className="workshop-member-email">{member.email}</span>
                      </div>
                      <span className="workshop-member-action">
                        {addingMemberId === member.id ? 'Adding...' : 'Add'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Workshop
