import React, { useEffect, useState } from 'react'
import { Crown, Trophy, Flame, Lock, CheckCircle2, Award } from 'lucide-react'
import apiClient from '@services/api'
import { type AuthUser } from '@services/auth'
import '../styles/Leaderboard.css'

// ── Types ───────────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  xp: number
  tickets_resolved: number
  level: number
}

interface LeaderboardSummary {
  leader_name: string
  total_resolved: number
  avg_per_day: number
  current_user_rank: number
  total_members: number
}

interface LeaderboardData {
  entries: LeaderboardEntry[]
  summary: LeaderboardSummary
  week_start: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7048e8','#1971c2','#2f9e44','#f08c00','#c2255c','#0c8599','#5f3dc4','#e03131']

function avatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function mockStreak(rank: number): number {
  return [7, 5, 4, 3, 3, 2, 2, 1, 1, 0][Math.min(rank - 1, 9)]
}

function mockVsDelta(userId: string): number {
  const sum = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ((sum % 9) - 4) // −4 to +4
}

function getNextMondayUTC(): Date {
  const now = new Date()
  const utcDay = now.getUTCDay() // 0=Sun 1=Mon … 6=Sat
  const daysUntil = ((8 - utcDay) % 7) || 7
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntil)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0d 00:00:00'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return d > 0 ? `${d}d ${hms}` : hms
}

// ── Static confetti dot definitions ─────────────────────────────────────────
const CONFETTI_DOTS = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  size: 3 + (i % 5) * 2,
  left: `${(i * 13 + 7) % 100}%`,
  top: `${(i * 17 + 11) % 88}%`,
  color: ['var(--accent)','var(--ink-400)','#f59e0b','#7048e8','#2f9e44'][i % 5],
  delay: `${((i * 7) % 30) / 10}s`,
  dur: `${2.5 + (i % 3) * 0.8}s`,
}))

// ── Achievement definitions ──────────────────────────────────────────────────
const ACHIEVEMENTS_DEF = [
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    icon: '⚡',
    desc: 'Resolve 10 tickets in under 1 hour',
    target: 10,
    color: '#f59e0b',
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    icon: '📈',
    desc: 'Climb 5+ ranks in a single week',
    target: 5,
    color: '#7048e8',
  },
  {
    id: 'top_5',
    name: 'Top 5 Finisher',
    icon: '🏅',
    desc: 'Finish in the top 5 this week',
    target: 1,
    color: '#f08c00',
  },
  {
    id: 'centurion',
    name: 'Centurion',
    icon: '💯',
    desc: 'Resolve 100 tickets in a single week',
    target: 100,
    color: '#e03131',
  },
]

// ── Component ────────────────────────────────────────────────────────────────
interface LeaderboardProps {
  user: AuthUser | null
}

const Leaderboard: React.FC<LeaderboardProps> = ({ user }) => {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [filter, setFilter] = useState<'top10' | 'top25' | 'all'>('top10')
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    apiClient.get('/workshops/leaderboard/')
      .then(res => { setData(res.data as LeaderboardData); setLoading(false) })
      .catch(() => { setFetchError('Failed to load leaderboard'); setLoading(false) })
  }, [])

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(getNextMondayUTC().getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="lb-state-box">
        <div className="lb-state-spinner" />
        <span>Loading leaderboard…</span>
      </div>
    )
  }

  if (fetchError || !data) {
    return (
      <div className="lb-state-box lb-state-error">
        <Trophy size={28} />
        <span>{fetchError || 'No leaderboard data available'}</span>
      </div>
    )
  }

  const { entries, summary } = data
  const maxXp = Math.max(1, ...entries.map(e => e.xp))
  const currentEntry = entries.find(e => e.user_id === user?.id)

  const filteredEntries = filter === 'top10'
    ? entries.slice(0, 10)
    : filter === 'top25'
      ? entries.slice(0, 25)
      : entries

  const achievementStatus = (id: string) => {
    const resolved = currentEntry?.tickets_resolved ?? 0
    const rank = summary.current_user_rank
    switch (id) {
      case 'speed_demon':
        return { unlocked: resolved >= 10, current: Math.min(resolved, 10), total: 10 }
      case 'comeback_kid':
        return { unlocked: false, current: 0, total: 5 }
      case 'top_5':
        return {
          unlocked: rank <= 5 && summary.total_members > 0,
          current: rank <= 5 ? 1 : 0,
          total: 1,
        }
      case 'centurion':
        return { unlocked: resolved >= 100, current: Math.min(resolved, 100), total: 100 }
      default:
        return { unlocked: false, current: 0, total: 1 }
    }
  }

  return (
    <div className="lb-root">

      {/* ── 1. HERO ── */}
      <div className="lb-hero">
        <div className="lb-confetti" aria-hidden="true">
          {CONFETTI_DOTS.map(d => (
            <span
              key={d.id}
              className="lb-confetti-dot"
              style={{
                width: d.size,
                height: d.size,
                left: d.left,
                top: d.top,
                background: d.color,
                animationDelay: d.delay,
                animationDuration: d.dur,
              }}
            />
          ))}
        </div>

        <div className="lb-hero-body">
          <div className="lb-overline">
            <span className="lb-overline-dash">—</span>
            WEEKLY LEADERBOARD
            <span className="lb-overline-dash">—</span>
          </div>
          <h1 className="lb-hero-heading">
            Top resolvers this <span className="lb-red">week</span>
          </h1>
          <p className="lb-hero-sub">Rankings reset every Monday at 00:00 UTC</p>
        </div>

        <div className="lb-hero-countdown">
          <div className="lb-countdown-label">Resets in</div>
          <div className="lb-countdown-value">{countdown}</div>
        </div>
      </div>

      {/* ── 2. STAT CARDS ── */}
      <div className="lb-stat-row">
        <div className="lb-stat-card">
          <Crown size={15} className="lb-stat-icon" />
          <div className="lb-stat-label">LEADER</div>
          <div className="lb-stat-value lb-stat-truncate">{summary.leader_name || '—'}</div>
        </div>
        <div className="lb-stat-card">
          <Award size={15} className="lb-stat-icon" />
          <div className="lb-stat-label">TOTAL RESOLVED</div>
          <div className="lb-stat-value">{summary.total_resolved}</div>
        </div>
        <div className="lb-stat-card">
          <Flame size={15} className="lb-stat-icon" />
          <div className="lb-stat-label">AVG / DAY</div>
          <div className="lb-stat-value">{summary.avg_per_day}</div>
        </div>
        <div className="lb-stat-card lb-stat-card-you">
          <Trophy size={15} className="lb-stat-icon lb-stat-icon-accent" />
          <div className="lb-stat-label">YOUR RANK</div>
          <div className="lb-stat-value">
            #{summary.current_user_rank}
            <span className="lb-of-n"> of {summary.total_members}</span>
          </div>
        </div>
      </div>

      {/* ── 3. STANDINGS TABLE ── */}
      <div className="lb-section">
        <div className="lb-section-header">
          <div className="lb-section-title-row">
            <h2 className="lb-section-heading">Standings</h2>
            <span className="lb-member-pill">{summary.total_members} members</span>
          </div>
          <div className="lb-filter-group">
            {(['top10', 'top25', 'all'] as const).map(f => (
              <button
                key={f}
                className={`lb-filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'top10' ? 'Top 10' : f === 'top25' ? 'Top 25' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-th lb-th-rank">RANK</th>
                <th className="lb-th lb-th-resolver">RESOLVER</th>
                <th className="lb-th lb-th-xp">XP THIS WEEK</th>
                <th className="lb-th lb-th-tickets">TICKETS</th>
                <th className="lb-th lb-th-streak">STREAK</th>
                <th className="lb-th lb-th-vs">VS LAST</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="lb-empty-row">No activity yet this week</td>
                </tr>
              )}
              {filteredEntries.map(entry => {
                const isMe = entry.user_id === user?.id
                const streak = mockStreak(entry.rank)
                const delta = mockVsDelta(entry.user_id)
                const xpPct = (entry.xp / maxXp) * 100

                return (
                  <tr key={entry.user_id} className={`lb-row${isMe ? ' lb-current-user' : ''}`}>

                    <td className="lb-td lb-td-rank">
                      {entry.rank === 1
                        ? <Crown size={17} className="lb-crown-icon" />
                        : <span className="lb-rank-num">#{entry.rank}</span>
                      }
                    </td>

                    <td className="lb-td lb-td-resolver">
                      <div className="lb-avatar-wrap">
                        <div
                          className="lb-avatar"
                          style={{ background: avatarColor(entry.full_name) }}
                        >
                          {getInitials(entry.full_name)}
                        </div>
                        <span className="lb-level-badge">Lv{entry.level}</span>
                      </div>
                      <span className="lb-resolver-name">{entry.full_name}</span>
                      {isMe && <span className="lb-you-tag">you</span>}
                    </td>

                    <td className="lb-td lb-td-xp">
                      <div className="lb-xp-row">
                        <div className="lb-xp-track">
                          <div
                            className="lb-xp-fill"
                            style={{ width: `${xpPct}%` }}
                          />
                        </div>
                        <span className="lb-xp-num">{entry.xp} XP</span>
                      </div>
                    </td>

                    <td className="lb-td lb-td-tickets">{entry.tickets_resolved}</td>

                    <td className="lb-td lb-td-streak">
                      {streak > 0
                        ? <span className="lb-streak"><Flame size={12} className="lb-flame-icon" />{streak}d</span>
                        : <span className="lb-muted">—</span>
                      }
                    </td>

                    <td className="lb-td lb-td-vs">
                      {delta > 0
                        ? <span className="lb-delta-up">▲{delta}</span>
                        : delta < 0
                          ? <span className="lb-delta-down">▼{Math.abs(delta)}</span>
                          : <span className="lb-muted">—</span>
                      }
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. WEEKLY PRIZE ── */}
      <div className="lb-prize-card">
        <div className="lb-prize-left">
          <span className="lb-prize-medal" aria-hidden="true">🏅</span>
          <div className="lb-prize-info">
            <div className="lb-prize-title">Champion's Hoodie</div>
            <div className="lb-prize-sub">$200 swag credit for this week's #1 resolver</div>
          </div>
        </div>
        <div className="lb-prize-right">
          <div className="lb-prize-cd-label">Claim window closes in</div>
          <div className="lb-prize-cd-value">{countdown}</div>
        </div>
      </div>

      {/* ── 5. YOUR ACHIEVEMENTS ── */}
      <div className="lb-section lb-section-last">
        <div className="lb-section-header">
          <div className="lb-section-title-row">
            <h2 className="lb-section-heading">Your Achievements</h2>
          </div>
        </div>

        <div className="lb-ach-grid">
          {ACHIEVEMENTS_DEF.map(ach => {
            const { unlocked, current, total } = achievementStatus(ach.id)
            const pct = Math.min(100, (current / total) * 100)

            return (
              <div
                key={ach.id}
                className={`lb-ach-card${unlocked ? ' lb-ach-unlocked' : ' lb-ach-locked'}`}
              >
                <div
                  className="lb-ach-icon-box"
                  style={unlocked
                    ? { background: `${ach.color}1a`, border: `1px solid ${ach.color}40` }
                    : undefined
                  }
                >
                  {unlocked
                    ? <span className="lb-ach-emoji">{ach.icon}</span>
                    : <Lock size={16} className="lb-lock-icon" />
                  }
                </div>

                <div className="lb-ach-body">
                  <div className="lb-ach-name-row">
                    <span className="lb-ach-name">{ach.name}</span>
                    {unlocked && <CheckCircle2 size={13} className="lb-ach-check" />}
                  </div>
                  <p className="lb-ach-desc">{ach.desc}</p>
                  <div className="lb-ach-track">
                    <div
                      className="lb-ach-fill"
                      style={{
                        width: `${pct}%`,
                        background: unlocked ? ach.color : undefined,
                      }}
                    />
                  </div>
                  <div className="lb-ach-progress-label">
                    {current} / {total}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default Leaderboard
