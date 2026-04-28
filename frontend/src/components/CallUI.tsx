import React from 'react'
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import type { CallState } from '../hooks/useWebRTC'
import '../styles/CallUI.css'

interface Props {
  callState: CallState
  remoteUserName: string
  onAnswer: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
  remoteAudioRef: React.RefObject<HTMLAudioElement>
}

const CallUI: React.FC<Props> = ({
  callState,
  remoteUserName,
  onAnswer,
  onReject,
  onEnd,
  onToggleMute,
  remoteAudioRef,
}) => {
  if (callState.status === 'idle') return null

  const initial = remoteUserName.charAt(0).toUpperCase()

  const statusLabel =
    callState.status === 'incoming'
      ? 'Incoming call…'
      : callState.status === 'calling'
        ? 'Calling…'
        : 'Connected'

  return (
    <div className="call-overlay">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="call-panel">
        <div className="call-avatar">{initial}</div>
        <div className="call-name">{remoteUserName}</div>
        <div className="call-status">{statusLabel}</div>
        <div className="call-actions">
          {callState.status === 'incoming' ? (
            <>
              <button
                className="call-btn call-btn--accept"
                onClick={onAnswer}
                title="Accept"
              >
                <Phone size={20} />
              </button>
              <button
                className="call-btn call-btn--end"
                onClick={onReject}
                title="Decline"
              >
                <PhoneOff size={20} />
              </button>
            </>
          ) : (
            <>
              {callState.status === 'connected' && (
                <button
                  className={`call-btn ${callState.isMuted ? 'call-btn--muted' : 'call-btn--mute'}`}
                  onClick={onToggleMute}
                  title={callState.isMuted ? 'Unmute' : 'Mute'}
                >
                  {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}
              <button
                className="call-btn call-btn--end"
                onClick={onEnd}
                title="End call"
              >
                <PhoneOff size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallUI
