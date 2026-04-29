import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AtSign, Bell, Headphones, Mic, MicOff, MonitorUp, Paperclip, PhoneOff, Phone, Plus, Send, Settings, Smile, Ticket, UserPlus, Users, Volume2, VolumeX } from 'lucide-react'
import CallUI from '../components/CallUI'
import CreateWorkshopModal from '../components/CreateWorkshopModal'
import { useWebRTC, type CallSignalData } from '../hooks/useWebRTC'
import { useVoiceChannel, type VoiceStatePayload, type VoiceSignalData } from '../hooks/useVoiceChannel'
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
    workbench_id: '',
    resolution: '',
    assignee_id: '',
  })

  const wsRef = useRef<WebSocket | null>(null)
  const prevChannelRef = useRef<string | null>(null)
  const activeChannelIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const { callState, startCall, answerCall, rejectCall, endCall, toggleMute, handleCallSignal, remoteAudioRef } =
    useWebRTC(wsRef)
  const voiceChannel = useVoiceChannel(wsRef, currentUserId)
  const [showCallPicker, setShowCallPicker] = useState(false)
  const [copiedWorkshopId, setCopiedWorkshopId] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [inVoice, setInVoice] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceDeafened, setVoiceDeafened] = useState(false)
  const [voiceExpanded, setVoiceExpanded] = useState(false)
  const [voicePreviewMuted, setVoicePreviewMuted] = useState(false)
  const [voicePreviewDeafened, setVoicePreviewDeafened] = useState(false)
  const [currentUserName, setCurrentUserName] = useState('')
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState<'all' | 'mine' | 'open' | 'high'>('all')

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
    const [workshopResult, meResult, membersResult] = await Promise.allSettled([
      apiClient.get('/workshops/me/'),
      apiClient.get('/auth/me/'),
      apiClient.get('/workshops/me/members/'),
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
      setCurrentUserName(me?.full_name ?? `${me?.first_name ?? ''} ${me?.last_name ?? ''}`.trim())
    } else {
      setCurrentRole('')
      setCurrentUserId('')
      setCurrentUserName('')
    }

    if (membersResult.status === 'fulfilled') {
      setWorkshopMembers(unwrapListPayload<WorkshopMember>(membersResult.value.data))
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
      } else if (event.type === 'voice.state') {
        voiceChannel.handleVoiceState(event.data as VoiceStatePayload)
      } else if (event.type === 'call.signal' && (event.data as VoiceSignalData).context === 'voice') {
        void voiceChannel.handleVoiceSignal(event.data as VoiceSignalData)
      } else if (event.type === 'call.signal') {
        handleCallSignal(event.data as CallSignalData)
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

  const handleOpenCallPicker = async () => {
    if (showCallPicker) {
      setShowCallPicker(false)
      return
    }
    setShowCallPicker(true)
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

  const handleOpenSettings = async () => {
    setIsSettingsOpen(true)
    if (workshopMembers.length > 0) return

    setWorkshopMembersLoading(true)
    try {
      const res = await apiClient.get('/workshops/me/members/')
      setWorkshopMembers(unwrapListPayload<WorkshopMember>(res.data))
    } catch {
      setWorkshopMembers([])
    } finally {
      setWorkshopMembersLoading(false)
    }
  }

  const handleJoinVoice = async () => {
    const ok = await voiceChannel.join(voicePreviewMuted, voicePreviewDeafened)
    if (!ok) return
    setVoiceOpen(false)
    setInVoice(true)
    setVoiceMuted(voicePreviewMuted)
    setVoiceDeafened(voicePreviewDeafened)
    const displayName = currentUserName || 'You'
    const sysMsg: ChatMessage = {
      id: `__sys_voice_${Date.now()}`,
      content: `${displayName} joined workshop voice`,
      is_encrypted: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      reply_to_id: null,
      channel_id: activeChannelId ?? undefined,
      sender: {
        id: '__system__',
        email: '',
        first_name: '',
        last_name: '',
        full_name: '',
        role: '',
        avatar_url: null,
      },
    }
    setMessages((prev) => [...prev, sysMsg])
  }

  const handleLeaveVoice = () => {
    voiceChannel.leave()
    setInVoice(false)
    setVoiceExpanded(false)
    setVoiceMuted(false)
    setVoiceDeafened(false)
    setVoicePreviewMuted(false)
    setVoicePreviewDeafened(false)
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
      workbench_id: ticket.workbench?.id || activeWorkbenchId || '',
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
        workbench_id: editTicketForm.workbench_id || undefined,
        resolution: editTicketForm.resolution.trim(),
        assignee_id: editTicketForm.assignee_id || null,
      })

      const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data) as TicketItem
      const ticketId = patchedTicket?.id || selectedTicket.id
      const detailResponse = await apiClient.get(`/tickets/${ticketId}/`)
      const persistedTicket = detailResponse.data as TicketItem

      if (persistedTicket?.id) {
        const nextWorkbenchId = persistedTicket.workbench?.id || editTicketForm.workbench_id
        if (nextWorkbenchId && activeWorkbenchId && nextWorkbenchId !== activeWorkbenchId) {
          setTickets((prev) => prev.filter((ticket) => ticket.id !== persistedTicket.id))
        } else {
          setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)))
        }
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
        data?.workbench_id?.[0] ||
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
  const ownerMember = useMemo(
    () => workshopMembers.find((member) => String(member.role).toUpperCase() === 'OWNER') ?? null,
    [workshopMembers]
  )
  const technicianMembers = useMemo(
    () => workshopMembers.filter((member) => String(member.role).toUpperCase() === 'TECHNICIAN'),
    [workshopMembers]
  )
  const publicIntakeUrl = useMemo(() => {
    const slug = workshop?.slug
    if (!slug) return ''

    const configuredBase = String(apiClient.defaults.baseURL ?? '').replace(/\/$/, '')
    if (!configuredBase) return `/api/workshops/${slug}/intake/`
    return `${configuredBase}/workshops/${slug}/intake/`
  }, [workshop])
  const remoteUserName = useMemo(() => {
    if (!callState.remoteUserId) return 'Unknown'
    const m = workshopMembers.find((member) => member.id === callState.remoteUserId)
    return m?.full_name || m?.email || 'Unknown'
  }, [callState.remoteUserId, workshopMembers])

  const filteredWorkbenches = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase()
    if (!q) return workbenches
    return workbenches.filter((wb) => wb.name.toLowerCase().includes(q))
  }, [workbenches, sidebarSearch])

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'mine') return tickets.filter((t) => t.assignee?.id === currentUserId)
    if (ticketFilter === 'open') return tickets.filter((t) => t.status === 'OPEN')
    if (ticketFilter === 'high') return tickets.filter((t) => t.urgency === 'HIGH' || t.urgency === 'CRITICAL')
    return tickets
  }, [tickets, ticketFilter, currentUserId])

  const filteredMembers = availableMembers.filter((member) => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return true
    return [member.username, member.full_name, member.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  const getVoiceInitials = (name: string) =>
    name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??'

  const selfInitials = currentUserName
    ? currentUserName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ME'

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
              className={`workshop-action-btn workshop-action-btn-primary${inVoice ? ' workshop-action-btn--voice-active' : ''}`}
              onClick={() => { if (!inVoice) setVoiceOpen(true) }}
              title="Workshop voice"
            >
              {inVoice ? (
                <>
                  <span className="voice-active-dot" />
                  <Headphones size={14} strokeWidth={1.75} />
                  Workshop voice
                </>
              ) : (
                <>
                  <Headphones size={14} strokeWidth={1.75} />
                  Workshop voice
                </>
              )}
            </button>
            <button
              className="workshop-action-btn workshop-action-btn-primary"
              onClick={handleOpenInviteModal}
              disabled={!canInviteMembers}
              title={canInviteMembers ? 'Invite a member' : 'Only workshop owners can invite members'}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              Invite Member
            </button>
            <button
              className="workshop-action-btn workshop-action-btn-primary"
              onClick={() => void handleOpenSettings()}
              disabled={!workshop}
              title={workshop ? 'View workshop settings' : 'No workshop available'}
            >
              <Settings size={14} strokeWidth={1.75} />
              Settings
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
              <div className="workshop-sidebar-search">
                <input
                  type="search"
                  placeholder="Search..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
              </div>
              {filteredWorkbenches.length === 0 ? (
                <p style={{ padding: '12px', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                  {workbenches.length === 0
                    ? workshop ? 'No workbenches yet.' : 'Create a workshop to get started.'
                    : 'No matches.'}
                </p>
              ) : (
                filteredWorkbenches.map((workbench) => (
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
              <div className="workshop-sidebar-footer">
                <div className="sidebar-footer-avatar">
                  {selfInitials}
                  <span className="sidebar-online-dot" />
                </div>
                <span className="sidebar-footer-name">{currentUserName || 'You'}</span>
              </div>
            </aside>

            <div className="workshop-middle">
              <div className="workshop-middle-header">
                <Ticket size={15} strokeWidth={1.75} style={{ color: 'var(--fg-muted)' }} />
                <h2>{activeWorkbench?.name ?? workshop?.name ?? 'Workbench'}</h2>
                {workshop?.member_count ? (
                  <span className="member-count-chip">
                    <Users size={11} strokeWidth={1.75} />
                    {workshop.member_count}
                  </span>
                ) : null}
                <button
                  className="workshop-action-btn"
                  style={{ marginLeft: 'auto' }}
                  title="Workshop voice"
                  onClick={() => { if (!inVoice) setVoiceOpen(true) }}
                >
                  <Headphones size={14} strokeWidth={1.75} />
                </button>
                <button className="workshop-action-btn" title="Notifications">
                  <Bell size={14} strokeWidth={1.75} />
                </button>
              </div>

              <div className="workshop-tickets">
                <div className="tickets-pane-header">
                  <span className="ticket-count-chip">{filteredTickets.length}</span>
                  <div className="ticket-filter-pills">
                    {(['all', 'mine', 'open', 'high'] as const).map((f) => (
                      <button
                        key={f}
                        className={`ticket-filter-pill${ticketFilter === f ? ' active' : ''}`}
                        onClick={() => setTicketFilter(f)}
                      >
                        {f === 'all' ? 'All' : f === 'mine' ? 'Mine' : f === 'open' ? 'Open' : 'High Priority'}
                      </button>
                    ))}
                  </div>
                  {activeWorkbenchId ? (
                    <button
                      className="workshop-action-btn workshop-action-btn-primary"
                      onClick={handleOpenCreateTicket}
                      title="Create a ticket in this workbench"
                    >
                      <Plus size={14} strokeWidth={1.75} />
                      New Ticket
                    </button>
                  ) : null}
                </div>
                <div className="tickets-pane-list">
                  {filteredTickets.length === 0 ? (
                    <p style={{ color: 'var(--fg-muted)', padding: '8px 0', fontSize: '0.85rem' }}>
                      {tickets.length === 0 ? 'No tickets in this workbench.' : 'No tickets match this filter.'}
                    </p>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const assigneeLabel = ticket.assignee?.full_name || ticket.assignee?.email || 'Unassigned'
                      const priorityClass = (ticket.urgency || 'medium').toLowerCase()

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
                            <span className={`ticket-priority ${priorityClass}`}>
                              {priorityClass}
                            </span>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="workshop-chat">
                {activeChannelId ? (
                  <>
                    <div className="chat-messages">
                      {messages.map((message) => {
                        if (message.sender.id === '__system__') {
                          return (
                            <div key={message.id} className="chat-system-message">
                              <Headphones size={12} strokeWidth={1.75} />
                              {message.content}
                            </div>
                          )
                        }
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
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="chat-composer">
                      <input
                        className="chat-composer-input"
                        placeholder={`Message ${activeWorkbench?.name ?? 'workbench'}...`}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                      />
                      <div className="chat-composer-actions">
                        <button type="button" className="chat-composer-action-btn" title="Attach file" disabled>
                          <Paperclip size={14} strokeWidth={1.75} />
                        </button>
                        <button type="button" className="chat-composer-action-btn" title="Mention" disabled>
                          <AtSign size={14} strokeWidth={1.75} />
                        </button>
                        <button type="button" className="chat-composer-action-btn" title="Emoji" disabled>
                          <Smile size={14} strokeWidth={1.75} />
                        </button>
                        <div className="chat-call-picker-wrapper">
                          {showCallPicker && callState.status === 'idle' ? (
                            <div className="chat-call-picker">
                              {workshopMembersLoading ? (
                                <p className="chat-call-picker-empty">Loading…</p>
                              ) : workshopMembers.filter((m) => m.id !== currentUserId).length === 0 ? (
                                <p className="chat-call-picker-empty">No other members</p>
                              ) : (
                                workshopMembers
                                  .filter((m) => m.id !== currentUserId)
                                  .map((member) => (
                                    <button
                                      key={member.id}
                                      className="chat-call-picker-item"
                                      onClick={() => {
                                        setShowCallPicker(false)
                                        void startCall(member.id)
                                      }}
                                    >
                                      {member.full_name || member.email}
                                    </button>
                                  ))
                              )}
                            </div>
                          ) : null}
                          <button
                            className="chat-composer-action-btn"
                            onClick={() => void handleOpenCallPicker()}
                            disabled={callState.status !== 'idle'}
                            title="Start voice call"
                          >
                            <Phone size={14} strokeWidth={1.75} />
                          </button>
                        </div>
                        <button className="chat-composer-send" onClick={handleSend} disabled={sending}>
                          <Send size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '16px', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                    {creatingChannel ? 'Setting up channel…' : 'No channel linked to this workbench.'}
                  </div>
                )}
              </div>
            </div>

            <aside className="workshop-members-panel">
              {workshopMembers.length === 0 ? (
                <p style={{ padding: '0.75rem 1rem', color: 'var(--fg-subtle)', fontSize: '0.8rem' }}>
                  {workshopMembersLoading ? 'Loading...' : 'No members'}
                </p>
              ) : (
                <>
                  <div className="members-panel-section">
                    Active — {workshopMembers.length}
                  </div>
                  {workshopMembers.map((member) => {
                    const initials = `${member.first_name?.[0] ?? ''}${member.last_name?.[0] ?? ''}`.toUpperCase() || '?'
                    return (
                      <div key={member.id} className="members-panel-item">
                        <div className="members-panel-avatar">
                          {initials}
                          <span className="members-panel-status online" />
                        </div>
                        <span className="members-panel-name">
                          {member.full_name || member.username || member.email}
                        </span>
                      </div>
                    )
                  })}
                </>
              )}
            </aside>
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
                <label htmlFor="workshop_edit_ticket_workbench">Workbench</label>
                <select
                  id="workshop_edit_ticket_workbench"
                  value={editTicketForm.workbench_id}
                  onChange={(event) => setEditTicketForm((prev) => ({ ...prev, workbench_id: event.target.value }))}
                  disabled={savingTicket}
                >
                  <option value="">Select a workbench</option>
                  {workbenches.map((workbench) => (
                    <option key={workbench.id} value={workbench.id}>{workbench.name}</option>
                  ))}
                </select>
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

      <CallUI
        callState={callState}
        remoteUserName={remoteUserName}
        onAnswer={() => void answerCall()}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        remoteAudioRef={remoteAudioRef}
      />

      {/* Workshop Voice — pre-join modal */}
      {voiceOpen ? (
        <div className="modal-overlay" onClick={() => setVoiceOpen(false)}>
          <div className="voice-prejoin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="voice-prejoin-header">
              <div className="voice-prejoin-icon">
                <Headphones size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="voice-prejoin-title">Workshop voice</h2>
                <span className="voice-channel-tag"># general</span>
              </div>
            </div>

            <div className="voice-prejoin-avatars">
              {voiceChannel.participants.map((p) => (
                <div key={p.id} className="voice-prejoin-avatar" title={p.full_name}>
                  {getVoiceInitials(p.full_name)}
                </div>
              ))}
              {voiceChannel.participants.length > 0 && (
                <span className="voice-prejoin-count">{voiceChannel.participants.length} in channel</span>
              )}
            </div>

            <div className="voice-prejoin-toggles">
              <button
                type="button"
                className={`voice-toggle-btn${voicePreviewMuted ? ' voice-toggle-btn--off' : ''}`}
                onClick={() => setVoicePreviewMuted((m) => !m)}
              >
                {voicePreviewMuted ? <MicOff size={15} strokeWidth={1.75} /> : <Mic size={15} strokeWidth={1.75} />}
                {voicePreviewMuted ? 'Mic off' : 'Mic on'}
              </button>
              <button
                type="button"
                className={`voice-toggle-btn${voicePreviewDeafened ? ' voice-toggle-btn--off' : ''}`}
                onClick={() => setVoicePreviewDeafened((d) => !d)}
              >
                {voicePreviewDeafened ? <VolumeX size={15} strokeWidth={1.75} /> : <Volume2 size={15} strokeWidth={1.75} />}
                {voicePreviewDeafened ? 'Audio off' : 'Audio on'}
              </button>
            </div>

            {voiceChannel.errorMessage ? (
              <p className="voice-prejoin-error">{voiceChannel.errorMessage}</p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setVoiceOpen(false)} disabled={voiceChannel.joining}>Cancel</button>
              <button type="button" className="btn-submit" onClick={() => void handleJoinVoice()} disabled={voiceChannel.joining}>
                {voiceChannel.joining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Workshop Voice — persistent dock */}
      {inVoice ? (
        <div className="voice-dock" role="button" tabIndex={0} onClick={() => setVoiceExpanded(true)} onKeyDown={(e) => { if (e.key === 'Enter') setVoiceExpanded(true) }}>
          <div className="voice-dock-header">
            <span className="voice-active-dot" />
            <span className="voice-dock-label">Workshop voice</span>
          </div>
          <div className="voice-dock-participants">
            <div className={`voice-dock-avatar${!voiceMuted ? ' voice-dock-avatar--speaking' : ''}`} title="You">
              {selfInitials}
              {voiceMuted ? <span className="voice-dock-muted-badge"><MicOff size={8} strokeWidth={2} /></span> : null}
            </div>
            {voiceChannel.participants.map((p) => (
              <div key={p.id} className="voice-dock-avatar" title={p.full_name}>
                {getVoiceInitials(p.full_name)}
                {p.muted ? <span className="voice-dock-muted-badge"><MicOff size={8} strokeWidth={2} /></span> : null}
              </div>
            ))}
          </div>
          <div className="voice-dock-controls" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`voice-dock-btn${voiceMuted ? ' voice-dock-btn--active' : ''}`}
              onClick={() => { const next = !voiceMuted; setVoiceMuted(next); voiceChannel.applyMute(next) }}
              title={voiceMuted ? 'Unmute' : 'Mute'}
            >
              {voiceMuted ? <MicOff size={13} strokeWidth={1.75} /> : <Mic size={13} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              className={`voice-dock-btn${voiceDeafened ? ' voice-dock-btn--active' : ''}`}
              onClick={() => { const next = !voiceDeafened; setVoiceDeafened(next); voiceChannel.applyDeafen(next) }}
              title={voiceDeafened ? 'Undeafen' : 'Deafen'}
            >
              {voiceDeafened ? <VolumeX size={13} strokeWidth={1.75} /> : <Volume2 size={13} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              className="voice-dock-btn voice-dock-btn--leave"
              onClick={handleLeaveVoice}
              title="Leave voice"
            >
              <PhoneOff size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Workshop Voice — expanded modal */}
      {voiceExpanded ? (
        <div className="modal-overlay" onClick={() => setVoiceExpanded(false)}>
          <div className="voice-expanded-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="voice-active-dot" />
                <h2>Workshop voice</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setVoiceExpanded(false)} aria-label="Close">✕</button>
            </div>

            <div className="voice-participant-grid">
              <div className={`voice-tile${!voiceMuted ? ' voice-tile--speaking' : ''}`}>
                <div className="voice-tile-avatar">{selfInitials}</div>
                {!voiceMuted ? (
                  <div className="voice-equalizer">
                    <span className="voice-eq-bar" style={{ animationDelay: '0ms' }} />
                    <span className="voice-eq-bar" style={{ animationDelay: '120ms' }} />
                    <span className="voice-eq-bar" style={{ animationDelay: '60ms' }} />
                    <span className="voice-eq-bar" style={{ animationDelay: '180ms' }} />
                  </div>
                ) : null}
                <span className="voice-tile-name">You</span>
                {voiceMuted ? <span className="voice-tile-badge"><MicOff size={10} strokeWidth={2} /></span> : null}
              </div>
              {voiceChannel.participants.map((p) => (
                <div key={p.id} className="voice-tile">
                  <div className="voice-tile-avatar">{getVoiceInitials(p.full_name)}</div>
                  <span className="voice-tile-name">{p.full_name}</span>
                  {p.muted ? <span className="voice-tile-badge"><MicOff size={10} strokeWidth={2} /></span> : null}
                </div>
              ))}
            </div>

            <div className="voice-expanded-actions">
              <button
                type="button"
                className={`voice-expanded-btn${voiceMuted ? ' voice-expanded-btn--active' : ''}`}
                onClick={() => { const next = !voiceMuted; setVoiceMuted(next); voiceChannel.applyMute(next) }}
              >
                {voiceMuted ? <MicOff size={16} strokeWidth={1.75} /> : <Mic size={16} strokeWidth={1.75} />}
                {voiceMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                className={`voice-expanded-btn${voiceDeafened ? ' voice-expanded-btn--active' : ''}`}
                onClick={() => { const next = !voiceDeafened; setVoiceDeafened(next); voiceChannel.applyDeafen(next) }}
              >
                {voiceDeafened ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
                {voiceDeafened ? 'Undeafen' : 'Deafen'}
              </button>
              <button
                type="button"
                className="voice-expanded-btn"
                disabled
                title="Screen sharing not available in this version"
              >
                <MonitorUp size={16} strokeWidth={1.75} />
                Share screen
              </button>
              <button
                type="button"
                className="voice-expanded-btn voice-expanded-btn--leave"
                onClick={handleLeaveVoice}
              >
                <PhoneOff size={16} strokeWidth={1.75} />
                Leave voice
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen && workshop ? (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Workshop Settings</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="workshop-form workshop-settings-content">
              <div className="form-group">
                <label>Name</label>
                <input value={workshop.name} disabled />
              </div>

              <div className="form-group">
                <label>Workshop ID</label>
                <div className="workshop-settings-url-row">
                  <input value={workshop.id} disabled />
                  <button
                    type="button"
                    className="btn-submit"
                    onClick={() => {
                      if (!workshop.id) return
                      void navigator.clipboard.writeText(workshop.id).then(() => {
                        setCopiedWorkshopId(true)
                        setTimeout(() => setCopiedWorkshopId(false), 1500)
                      })
                    }}
                  >
                    {copiedWorkshopId ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Owner</label>
                <input
                  value={ownerMember ? `${ownerMember.first_name} ${ownerMember.last_name} (${ownerMember.email})` : 'Not available'}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Technicians</label>
                {workshopMembersLoading ? (
                  <p className="workshop-member-empty">Loading technicians...</p>
                ) : technicianMembers.length === 0 ? (
                  <p className="workshop-member-empty">No technicians found.</p>
                ) : (
                  <ul className="workshop-settings-list">
                    {technicianMembers.map((member) => (
                      <li key={member.id}>{member.first_name} {member.last_name} ({member.email})</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label>Public Ticket Submission URL</label>
                <div className="workshop-settings-url-row">
                  <input value={publicIntakeUrl} disabled />
                  <button
                    type="button"
                    className="btn-submit"
                    onClick={() => {
                      if (!publicIntakeUrl) return
                      void navigator.clipboard.writeText(publicIntakeUrl)
                    }}
                  >
                    Copy URL
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsSettingsOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Workshop
