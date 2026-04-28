import apiClient from './api'

export interface Workbench {
  id: string
  name: string
  description: string
  color: string
  is_active: boolean
}

export interface Channel {
  id: string
  name: string
  type: 'DIRECT' | 'PRIVATE' | 'PUBLIC' | 'VOICE'
  is_encrypted: boolean
  updated_at: string
  last_message: {
    id: string
    content: string
    sender: ChatUser
    created_at: string
  } | null
}

export interface ChatUser {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  avatar_url: string | null
}

export interface ChatMessage {
  id: string
  content: string
  is_encrypted: boolean
  created_at: string
  edited_at: string | null
  reply_to_id: string | null
  channel_id?: string
  sender: ChatUser
}

export interface TicketItem {
  id: string
  title: string
  description: string
  status: string
  urgency: string
  category: string
  asset_id: string
  resolution: string
  created_at: string
  updated_at: string
  requestor: ChatUser
  assignee: ChatUser | null
  workbench?: {
    id: string
    name: string
  }
}

function unwrapListPayload<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (Array.isArray(payload?.data)) return payload.data as T[]
  if (Array.isArray(payload?.results)) return payload.results as T[]
  if (Array.isArray(payload?.data?.results)) return payload.data.results as T[]
  return []
}

export async function fetchWorkbenches(): Promise<Workbench[]> {
  const res = await apiClient.get('/workbenches/')
  return unwrapListPayload<Workbench>(res.data)
}

export async function fetchTickets(workbenchId: string): Promise<TicketItem[]> {
  const res = await apiClient.get(`/tickets/?workbench=${workbenchId}&limit=20`)
  return unwrapListPayload<TicketItem>(res.data)
}

export async function fetchChannels(): Promise<Channel[]> {
  const res = await apiClient.get('/messaging/channels/')
  return res.data.data?.channels ?? []
}

export async function fetchMessages(channelId: string): Promise<ChatMessage[]> {
  const res = await apiClient.get(`/messaging/channels/${channelId}/messages/?limit=50`)
  const msgs: ChatMessage[] = res.data.data?.messages ?? []
  return msgs.reverse() // API returns newest-first; display oldest-first
}

export async function postMessage(channelId: string, content: string): Promise<ChatMessage> {
  const res = await apiClient.post(`/messaging/channels/${channelId}/messages/`, { content })
  return res.data.data?.message
}

export async function createChannel(name: string, memberIds: string[]): Promise<Channel> {
  const res = await apiClient.post('/messaging/channels/', {
    name,
    type: 'PUBLIC',
    member_ids: memberIds,
  })
  return res.data.data?.channel
}

export function connectWebSocket(
  token: string,
  onMessage: (event: { type: string; data: any }) => void
): WebSocket {
  const wsUrl = `ws://localhost:8000/ws/?token=${encodeURIComponent(token)}`
  const ws = new WebSocket(wsUrl)
  ws.onmessage = (raw) => {
    try {
      onMessage(JSON.parse(raw.data))
    } catch {
      // ignore malformed frames
    }
  }
  return ws
}

export function joinChannel(ws: WebSocket, channelId: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'channel.join', data: { channel_id: channelId } }))
  }
}

export function leaveChannel(ws: WebSocket, channelId: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'channel.leave', data: { channel_id: channelId } }))
  }
}
