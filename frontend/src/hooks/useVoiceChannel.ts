/// <reference types="vite/client" />
import { useCallback, useEffect, useRef, useState } from 'react'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export interface VoiceParticipant {
  id: string
  full_name: string
  muted: boolean
}

export interface VoiceStatePayload {
  event: 'join' | 'leave' | 'mute_update'
  user_id: string
  participants: VoiceParticipant[]
}

export interface VoiceSignalData {
  signal: 'offer' | 'answer' | 'ice_candidate' | 'end'
  from_user_id: string
  context: 'voice' | 'call'
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export interface UseVoiceChannelReturn {
  participants: VoiceParticipant[]
  joining: boolean
  errorMessage: string | null
  join: (initialMuted: boolean, initialDeafened: boolean) => Promise<boolean>
  leave: () => void
  applyMute: (muted: boolean) => void
  applyDeafen: (deafened: boolean) => void
  handleVoiceState: (data: VoiceStatePayload) => void
  handleVoiceSignal: (data: VoiceSignalData) => Promise<void>
}

export function useVoiceChannel(
  wsRef: { current: WebSocket | null },
  currentUserId: string,
): UseVoiceChannelReturn {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [joining, setJoining] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Refs let callbacks stay stable and always read the latest values
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audioElemsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const inVoiceRef = useRef(false)
  const currentUserIdRef = useRef(currentUserId)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  const sendWs = useCallback(
    (type: string, data: object) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }))
      }
    },
    [wsRef],
  )

  const closePeer = useCallback((userId: string) => {
    const pc = peersRef.current.get(userId)
    if (pc) {
      pc.close()
      peersRef.current.delete(userId)
    }
    const audio = audioElemsRef.current.get(userId)
    if (audio) {
      audio.srcObject = null
      audioElemsRef.current.delete(userId)
    }
  }, [])

  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      closePeer(targetUserId)

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendWs('call.ice_candidate', {
            target_user_id: targetUserId,
            candidate: candidate.toJSON(),
            context: 'voice',
          })
        }
      }

      pc.ontrack = ({ streams }) => {
        if (streams[0]) {
          let audio = audioElemsRef.current.get(targetUserId)
          if (!audio) {
            audio = new Audio()
            audio.autoplay = true
            audioElemsRef.current.set(targetUserId, audio)
          }
          audio.srcObject = streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          closePeer(targetUserId)
        }
      }

      peersRef.current.set(targetUserId, pc)
      return pc
    },
    [sendWs, closePeer],
  )

  const initiateOfferTo = useCallback(
    async (targetUserId: string) => {
      if (!localStreamRef.current) return
      try {
        const pc = createPeerConnection(targetUserId)
        localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendWs('call.offer', { target_user_id: targetUserId, offer, context: 'voice' })
      } catch {
        closePeer(targetUserId)
      }
    },
    [createPeerConnection, sendWs, closePeer],
  )

  const join = useCallback(
    async (initialMuted: boolean, _initialDeafened: boolean): Promise<boolean> => {
      setJoining(true)
      setErrorMessage(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        localStreamRef.current = stream
        stream.getAudioTracks().forEach((t) => { t.enabled = !initialMuted })
        inVoiceRef.current = true
        sendWs('voice.join', { muted: initialMuted })
        return true
      } catch {
        setErrorMessage('Could not access microphone. Check browser permissions.')
        return false
      } finally {
        setJoining(false)
      }
    },
    [sendWs],
  )

  const leave = useCallback(() => {
    sendWs('voice.leave', {})
    inVoiceRef.current = false
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
    audioElemsRef.current.forEach((el) => { el.srcObject = null })
    audioElemsRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setParticipants([])
    setErrorMessage(null)
  }, [sendWs])

  const applyMute = useCallback(
    (muted: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted })
      sendWs('voice.mute_update', { muted })
    },
    [sendWs],
  )

  const applyDeafen = useCallback((deafened: boolean) => {
    audioElemsRef.current.forEach((el) => { el.muted = deafened })
  }, [])

  const handleVoiceState = useCallback(
    (data: VoiceStatePayload) => {
      const others = (data.participants ?? []).filter(
        (p) => p.id !== currentUserIdRef.current,
      )
      setParticipants(others)

      if (data.event === 'join' && data.user_id !== currentUserIdRef.current && inVoiceRef.current) {
        void initiateOfferTo(data.user_id)
      }
      if (data.event === 'leave') {
        closePeer(data.user_id)
      }
    },
    [initiateOfferTo, closePeer],
  )

  const handleVoiceSignal = useCallback(
    async (data: VoiceSignalData) => {
      if (!inVoiceRef.current) return
      const { signal, from_user_id } = data
      try {
        if (signal === 'offer') {
          const pc = createPeerConnection(from_user_id)
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!))
          }
          await pc.setRemoteDescription(data.offer!)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendWs('call.answer', { target_user_id: from_user_id, answer, context: 'voice' })
        } else if (signal === 'answer') {
          const pc = peersRef.current.get(from_user_id)
          if (pc) await pc.setRemoteDescription(data.answer!)
        } else if (signal === 'ice_candidate' && data.candidate) {
          const pc = peersRef.current.get(from_user_id)
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
      } catch {
        // ignore individual peer failures
      }
    },
    [createPeerConnection, sendWs],
  )

  return {
    participants,
    joining,
    errorMessage,
    join,
    leave,
    applyMute,
    applyDeafen,
    handleVoiceState,
    handleVoiceSignal,
  }
}
