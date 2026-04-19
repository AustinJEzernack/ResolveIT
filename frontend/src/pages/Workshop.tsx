import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/Workshop.css'

interface Channel {
  id: string
  name: string
}

interface Member {
  id: string
  name: string
  status: 'online' | 'offline' | 'away'
}

interface Message {
  id: string
  author: string
  content: string
  timestamp: string
}

interface Ticket {
  id: string
  title: string
  status: 'open' | 'in-progress' | 'closed'
  priority: 'low' | 'medium' | 'high'
  assignee: string
}

type ChannelMessages = {
  [key: string]: Message[]
}

const Workshop: React.FC = () => {
  const { workshopId } = useParams()
  const navigate = useNavigate()
  
  const [channels, setChannels] = useState<Channel[]>([
    { id: '1', name: 'general' },
    { id: '2', name: 'announcements' },
    { id: '3', name: 'random' },
  ])
  
  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: 'John Doe', status: 'online' },
    { id: '2', name: 'Jane Smith', status: 'online' },
    { id: '3', name: 'Bob Johnson', status: 'away' },
    { id: '4', name: 'Alice Williams', status: 'offline' },
  ])
  
  const [channelMessages, setChannelMessages] = useState<ChannelMessages>({
    '1': [
      { id: '1', author: 'John Doe', content: 'Welcome to the general channel!', timestamp: '10:30 AM' },
      { id: '2', author: 'Jane Smith', content: 'Great to be here', timestamp: '10:32 AM' },
    ],
    '2': [
      { id: '3', author: 'Admin', content: 'Important announcement coming soon!', timestamp: '9:00 AM' },
    ],
    '3': [
      { id: '4', author: 'Bob Johnson', content: 'Anyone want to grab coffee?', timestamp: '11:00 AM' },
      { id: '5', author: 'Alice Williams', content: 'Sounds good!', timestamp: '11:05 AM' },
    ],
  })
  
  const [selectedChannel, setSelectedChannel] = useState<Channel>(channels[0])
  const [messageInput, setMessageInput] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([
    { id: '1', title: 'Fix login bug', status: 'in-progress', priority: 'high', assignee: 'John Doe' },
    { id: '2', title: 'Add new feature', status: 'open', priority: 'medium', assignee: 'Jane Smith' },
    { id: '3', title: 'Update documentation', status: 'open', priority: 'low', assignee: 'Bob Johnson' },
  ])
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false)

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        author: 'Current User',
        content: messageInput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setChannelMessages({
        ...channelMessages,
        [selectedChannel.id]: [...(channelMessages[selectedChannel.id] || []), newMessage],
      })
      setMessageInput('')
    }
  }

  const currentMessages = channelMessages[selectedChannel.id] || []

  const handleCreateTicket = () => {
    const newTicket: Ticket = {
      id: Date.now().toString(),
      title: 'New Ticket',
      status: 'open',
      priority: 'medium',
      assignee: 'Unassigned',
    }
    setTickets([...tickets, newTicket])
    setIsCreateTicketOpen(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#007AFF'
      case 'in-progress':
        return '#FFA500'
      case 'closed':
        return '#00C853'
      default:
        return '#666666'
    }
  }

  return (
    <div className="workshop-container">
      {/* Sidebar - Channels */}
      <aside className="workshop-sidebar">
        <div className="workshop-header">
          <h2>Workshop Name</h2>
          <button className="back-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
            ←
          </button>
        </div>

        <div className="channels-section">
          <h3>Channels</h3>
          <ul className="channels-list">
            {channels.map((channel) => (
              <li key={channel.id}>
                <button
                  className={`channel-btn ${selectedChannel.id === channel.id ? 'active' : ''}`}
                  onClick={() => setSelectedChannel(channel)}
                >
                  # {channel.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content - Tickets and Chat Area */}
      <div className="workshop-middle">
        {/* Tickets Section - Between Channels and Chat */}
        <div className="tickets-section-middle">
          <div className="tickets-section-header">
            <h3>Tickets</h3>
            <button className="create-ticket-btn" onClick={handleCreateTicket} title="Create Ticket">
              +
            </button>
          </div>
          <ul className="tickets-section-list">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="ticket-item">
                <div className="ticket-info">
                  <div className="ticket-title">{ticket.title}</div>
                  <div className="ticket-details">
                    <span className="ticket-assignee">{ticket.assignee}</span>
                  </div>
                </div>
                <div className="ticket-badges">
                  <span className="ticket-status" style={{ backgroundColor: getStatusColor(ticket.status) }}>
                    {ticket.status}
                  </span>
                  <span className="ticket-priority" data-priority={ticket.priority}>
                    {ticket.priority}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Chat Area */}
        <div className="workshop-main">
        <div className="chat-header">
          <h2>#{selectedChannel.name}</h2>
        </div>

        <div className="messages-area">
          {currentMessages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            currentMessages.map((message) => (
              <div key={message.id} className="message">
                <div className="message-author">{message.author}</div>
                <div className="message-content">{message.content}</div>
                <div className="message-time">{message.timestamp}</div>
              </div>
            ))
          )}
        </div>

        <div className="message-input-area">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Message #${selectedChannel.name}`}
            className="message-input"
          />
          <button onClick={handleSendMessage} className="send-btn">
            Send
          </button>
        </div>
      </div>
      </div>

      {/* Right Sidebar - Members */}
      <aside className="members-sidebar">
        {/* Members Section */}
        <div className="sidebar-section">
          <h3>Members ({members.length})</h3>
          <ul className="members-list">
            {members.map((member) => (
              <li key={member.id} className={`member ${member.status}`}>
                <span className={`status-indicator ${member.status}`}></span>
                <span className="member-name">{member.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

export default Workshop
