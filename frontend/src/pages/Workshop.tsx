import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Ticket, Send } from 'lucide-react'
import mockAuth from '@services/mockAuth'
import '../styles/Workshop.css'

const MOCK_WORKBENCHES = [
  { id: '1', name: 'General Support', color: '#e03131' },
  { id: '2', name: 'Infrastructure', color: '#3B82F6' },
  { id: '3', name: 'Security', color: '#F59E0B' },
]

const MOCK_TICKETS = [
  { id: 'T-001', title: 'VPN keeps dropping for remote users', status: 'open' },
  { id: 'T-002', title: 'Email client not syncing on macOS', status: 'in-progress' },
  { id: 'T-003', title: 'Printer offline in Building B', status: 'resolved' },
  { id: 'T-004', title: 'Slow login times on shared workstations', status: 'open' },
]

const MOCK_MESSAGES = [
  { id: '1', sender: 'Alex R.', initials: 'AR', text: 'I can take a look at the VPN issue today.' },
  { id: '2', sender: 'Jamie L.', initials: 'JL', text: 'The printer in B is fixed — needed a driver update.' },
  { id: '3', sender: 'Alex R.', initials: 'AR', text: 'Good call, I\'ll close T-003 then.' },
]

const Workshop: React.FC = () => {
  const navigate = useNavigate()
  const user = mockAuth.getCurrentUser()
  const [activeWorkbench, setActiveWorkbench] = useState(MOCK_WORKBENCHES[0].id)
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [input, setInput] = useState('')

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : 'U'

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: `${user?.first_name} ${user?.last_name}`,
        initials,
        text,
      },
    ])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend()
  }

  const active = MOCK_WORKBENCHES.find(w => w.id === activeWorkbench)

  return (
    <div className="workshop-page">
      <nav className="workshop-navbar">
        <div className="workshop-navbar-left">
          <button className="workshop-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} strokeWidth={1.75} />
            Dashboard
          </button>
          <h1 className="workshop-title">My Workshop</h1>
        </div>
        <img src="/resolveIT_logo_final.svg" alt="ResolveIT" height={24} />
      </nav>

      <div className="workshop-body">
        {/* Sidebar — workbenches */}
        <aside className="workshop-sidebar">
          <div className="workshop-sidebar-header">Workbenches</div>
          {MOCK_WORKBENCHES.map(wb => (
            <div
              key={wb.id}
              className={`workbench-item ${wb.id === activeWorkbench ? 'active' : ''}`}
              onClick={() => setActiveWorkbench(wb.id)}
            >
              <span className="workbench-dot" style={{ backgroundColor: wb.color }} />
              {wb.name}
            </div>
          ))}
        </aside>

        {/* Middle: header + tickets + chat */}
        <div className="workshop-middle">
          <div className="workshop-middle-header">
            <Ticket size={15} strokeWidth={1.75} style={{ color: 'var(--fg-muted)' }} />
            <h2>{active?.name ?? 'Workbench'}</h2>
          </div>

          <div className="workshop-tickets">
            {MOCK_TICKETS.map(t => (
              <div key={t.id} className="ticket-row">
                <span className="ticket-id">{t.id}</span>
                <span className="ticket-title">{t.title}</span>
                <span className={`ticket-status ${t.status}`}>{t.status.replace('-', ' ')}</span>
              </div>
            ))}
          </div>

          <div className="workshop-chat">
            <div className="chat-messages">
              {messages.map(m => (
                <div key={m.id} className="chat-message">
                  <div className="chat-avatar">{m.initials}</div>
                  <div className="chat-bubble">
                    <div className="chat-sender">{m.sender}</div>
                    <div className="chat-text">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder="Message workbench..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="chat-send-btn" onClick={handleSend}>
                <Send size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Workshop
