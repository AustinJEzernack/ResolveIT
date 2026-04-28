/// <reference types="vite/client" />
import { useCallback, useRef, useState } from 'react'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected'

export interface CallState {
  status: CallStatus
  remoteUserId: string | null
  isMuted: boolean
}

export interface CallSignalData {
  signal: 'offer' | 'answer' | 'ice_candidate' | 'end'
  from_user_id: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export interface UseWebRTCReturn {
  callState: CallState
  startCall: (targetUserId: string) => Promise<void>
  answerCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleMute: () => void
  handleCallSignal: (data: CallSignalData) => void
  remoteAudioRef: React.RefObject<HTMLAudioElement>
}

export function useWebRTC(
  wsRef: { current: WebSocket | null },
): UseWebRTCReturn {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    remoteUserId: null,
    isMuted: false,
  })

  // Refs let callbacks read current values without becoming stale
  const callStatusRef = useRef<CallStatus>('idle')
  const isMutedRef = useRef(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const remoteUserIdRef = useRef<string | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const updateCallState = useCallback((updates: Partial<CallState>) => {
    if (updates.status !== undefined) callStatusRef.current = updates.status
    if (updates.isMuted !== undefined) isMutedRef.current = updates.isMuted
    setCallState((prev) => ({ ...prev, ...updates }))
  }, [])

  const sendWs = useCallback((type: string, data: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }))
    }
  }, [wsRef])

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    pendingOfferRef.current = null
    remoteUserIdRef.current = null
    callStatusRef.current = 'idle'
    isMutedRef.current = false
    setCallState({ status: 'idle', remoteUserId: null, isMuted: false })
  }, [])

  const buildPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendWs('call.ice_candidate', {
            target_user_id: targetUserId,
            candidate: candidate.toJSON(),
          })
        }
      }

      pc.ontrack = ({ streams }) => {
        if (remoteAudioRef.current && streams[0]) {
          remoteAudioRef.current.srcObject = streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed'
        ) {
          cleanup()
        }
      }

      return pc
    },
    [sendWs, cleanup],
  )

  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })
    localStreamRef.current = stream
    return stream
  }, [])

  const startCall = useCallback(
    async (targetUserId: string) => {
      if (callStatusRef.current !== 'idle') return

      remoteUserIdRef.current = targetUserId
      updateCallState({ status: 'calling', remoteUserId: targetUserId, isMuted: false })

      try {
        const stream = await getLocalStream()
        const pc = buildPeerConnection(targetUserId)
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendWs('call.offer', { target_user_id: targetUserId, offer })
      } catch {
        cleanup()
      }
    },
    [buildPeerConnection, getLocalStream, sendWs, cleanup, updateCallState],
  )

  const answerCall = useCallback(async () => {
    const fromUserId = remoteUserIdRef.current
    const pendingOffer = pendingOfferRef.current
    if (!fromUserId || !pendingOffer) return

    try {
      const stream = await getLocalStream()
      const pc = buildPeerConnection(fromUserId)
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await pc.setRemoteDescription(pendingOffer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      sendWs('call.answer', { target_user_id: fromUserId, answer })
      updateCallState({ status: 'connected' })
    } catch {
      cleanup()
    }
  }, [buildPeerConnection, getLocalStream, sendWs, cleanup, updateCallState])

  const rejectCall = useCallback(() => {
    const fromUserId = remoteUserIdRef.current
    if (fromUserId) sendWs('call.end', { target_user_id: fromUserId })
    cleanup()
  }, [sendWs, cleanup])

  const endCall = useCallback(() => {
    const targetUserId = remoteUserIdRef.current
    if (targetUserId) sendWs('call.end', { target_user_id: targetUserId })
    cleanup()
  }, [sendWs, cleanup])

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    const nextMuted = !isMutedRef.current
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted
    })
    updateCallState({ isMuted: nextMuted })
  }, [updateCallState])

  // Reads status from ref so this function stays stable regardless of call state
  const handleCallSignal = useCallback(
    (data: CallSignalData) => {
      const { signal, from_user_id } = data

      if (signal === 'offer') {
        if (callStatusRef.current !== 'idle') return
        remoteUserIdRef.current = from_user_id
        pendingOfferRef.current = data.offer ?? null
        updateCallState({ status: 'incoming', remoteUserId: from_user_id })
      } else if (signal === 'answer') {
        if (callStatusRef.current !== 'calling') return
        void pcRef.current
          ?.setRemoteDescription(data.answer!)
          .then(() => updateCallState({ status: 'connected' }))
      } else if (signal === 'ice_candidate' && data.candidate) {
        void pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate))
      } else if (signal === 'end') {
        cleanup()
      }
    },
    [updateCallState, cleanup],
  )

  return {
    callState,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    handleCallSignal,
    remoteAudioRef,
  }
}
