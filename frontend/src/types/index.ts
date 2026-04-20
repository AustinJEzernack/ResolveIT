export interface User {
  id: string
  username: string
  email: string
  avatar?: string
}

export interface Ticket {
  id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee?: User
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  sender: User
  content: string
  created_at: string
  ticket_id?: string
}

export interface Workshop {
  id: string
  title: string
  description: string
  content: string
  created_at: string
  updated_at: string
}
