import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Send, Ticket, UserPlus } from 'lucide-react'
import CreateWorkshopModal from '../components/CreateWorkshopModal'
import apiClient from '@services/api'
import {
  connectWebSocket,
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [availableMembers, setAvailableMembers] = useState<WorkshopMember[]>([])
  const [activeWorkbenchId, setActiveWorkbenchId] = useState<string | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const prevChannelRef = useRef<string | null>(null)

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
      setCurrentRole(meResult.value.data?.role ?? '')
    } else {
      setCurrentRole('')
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
        setMessages((prev) => [...prev, event.data as ChatMessage])
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

    fetchTickets(activeWorkbenchId).then(setTickets).catch(() => setTickets([]))

    const workbench = workbenches.find((item) => item.id === activeWorkbenchId)
    const match = channels.find((channel) => channel.name === workbench?.name)
    setActiveChannelId(match?.id ?? null)
    if (!match) setMessages([])
  }, [activeWorkbenchId, workbenches, channels])

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

  const activeWorkbench = workbenches.find((workbench) => workbench.id === activeWorkbenchId)
  const canCreateWorkshop = !workshop
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
            <button className="workshop-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={14} strokeWidth={1.75} />
              Dashboard
            </button>
            <h1 className="workshop-title">My Workshop</h1>
          </div>

          <div className="workshop-navbar-right">
            <button
              className="workshop-action-btn"
              onClick={handleOpenInviteModal}
              disabled={!canInviteMembers}
              title={canInviteMembers ? 'Invite a member' : 'Only workshop owners can invite members'}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              Invite Member
            </button>
            <button
              className="workshop-action-btn workshop-action-btn-primary"
              onClick={() => setIsCreateOpen(true)}
              disabled={!canCreateWorkshop}
              title={canCreateWorkshop ? 'Create a workshop' : 'You already belong to a workshop'}
            >
              <Plus size={14} strokeWidth={1.75} />
              Create Workshop
            </button>
            <img src="/resolveIT_logo_final.svg" alt="ResolveIT" height={24} />
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
              </div>

              <div className="workshop-tickets">
                {tickets.length === 0 ? (
                  <p style={{ color: 'var(--fg-muted)', padding: '8px 0', fontSize: '0.85rem' }}>
                    No tickets in this workbench.
                  </p>
                ) : (
                  tickets.map((ticket) => (
                    <div key={ticket.id} className="ticket-row">
                      <span className="ticket-id">{String(ticket.id).slice(0, 8)}</span>
                      <span className="ticket-title">{ticket.title}</span>
                      <span className={`ticket-status ${ticket.status.toLowerCase()}`}>
                        {ticket.status.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  ))
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
                              <div className="chat-sender">{message.sender.full_name}</div>
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
                  </>
                ) : (
                  <div style={{ padding: '16px', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                    No channel linked to this workbench.
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
