"""
Main WebSocket consumer for ResolveIT.

Handles:
  - Real-time message broadcasting
  - Typing indicators
  - In-app notification delivery
  - WebRTC signaling (offer/answer/ICE) for voice/video calls
  - Workshop voice channel presence (join/leave/mute)

Client event format:
  { "type": "<event_type>", "data": { ... } }
"""
import logging

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache

logger = logging.getLogger(__name__)

_VOICE_ROOM_TTL = 3600   # seconds; refreshed on every write
_PRESENCE_TTL   = 86400  # 24 hours


class MainConsumer(AsyncJsonWebsocketConsumer):

    # ─────────────────────────────────────────────
    # Connection lifecycle
    # ─────────────────────────────────────────────

    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser):
            await self.close(code=4001)
            return

        self.user = user
        self.workshop_id = str(user.workshop_id) if user.workshop_id else None
        if not self.workshop_id or self.workshop_id == "None":
            await self.close(code=4002)
            return
        self._joined_channels: set[str] = set()

        # Personal room — for direct notifications and DMs
        await self.channel_layer.group_add(f"user_{user.id}", self.channel_name)
        # Workshop-wide room — for broadcast events
        await self.channel_layer.group_add(f"workshop_{self.workshop_id}", self.channel_name)

        await self.accept()

        # Presence: register online and broadcast to workshop
        await self._presence_add(str(user.id))
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "user.presence",
                "data": {
                    "user_id": str(user.id),
                    "full_name": user.get_full_name() or user.email,
                    "action": "online",
                },
            },
        )
        logger.debug("WS connected: %s", user.id)

    async def disconnect(self, close_code):
        if not hasattr(self, "user"):
            return

        # Presence: broadcast offline before leaving the group so others receive it
        await self._presence_remove(str(self.user.id))
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "user.presence",
                "data": {
                    "user_id": str(self.user.id),
                    "full_name": self.user.get_full_name() or self.user.email,
                    "action": "offline",
                },
            },
        )

        await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)
        await self.channel_layer.group_discard(
            f"workshop_{self.workshop_id}", self.channel_name
        )
        for channel_id in self._joined_channels:
            await self.channel_layer.group_discard(
                f"channel_{channel_id}", self.channel_name
            )
        await self._voice_disconnect_cleanup()
        logger.debug("WS disconnected: %s", self.user.id)

    # ─────────────────────────────────────────────
    # Incoming events from client
    # ─────────────────────────────────────────────

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type")
        data = content.get("data", {})

        handlers = {
            "channel.join": self.handle_channel_join,
            "channel.leave": self.handle_channel_leave,
            "typing.start": self.handle_typing_start,
            "typing.stop": self.handle_typing_stop,
            # WebRTC signaling
            "call.offer": self.handle_call_offer,
            "call.answer": self.handle_call_answer,
            "call.ice_candidate": self.handle_call_ice_candidate,
            "call.end": self.handle_call_end,
            # Workshop voice presence
            "voice.join": self.handle_voice_join,
            "voice.leave": self.handle_voice_leave,
            "voice.mute_update": self.handle_voice_mute_update,
        }

        handler = handlers.get(event_type)
        if handler:
            await handler(data)
        else:
            await self.send_json(
                {"type": "error", "data": {"message": f"Unknown event type: {event_type}"}}
            )

    # ─────────────────────────────────────────────
    # Channel membership
    # ─────────────────────────────────────────────

    async def handle_channel_join(self, data: dict):
        channel_id = data.get("channel_id")
        if not channel_id:
            return

        if not await self._verify_membership(channel_id):
            await self.send_json(
                {"type": "error", "data": {"message": "Not a member of this channel"}}
            )
            return

        await self.channel_layer.group_add(f"channel_{channel_id}", self.channel_name)
        self._joined_channels.add(channel_id)
        await self.send_json({"type": "channel.joined", "data": {"channel_id": channel_id}})

    async def handle_channel_leave(self, data: dict):
        channel_id = data.get("channel_id")
        if channel_id:
            await self.channel_layer.group_discard(
                f"channel_{channel_id}", self.channel_name
            )
            self._joined_channels.discard(channel_id)

    # ─────────────────────────────────────────────
    # Typing indicators
    # ─────────────────────────────────────────────

    async def handle_typing_start(self, data: dict):
        channel_id = data.get("channel_id")
        if channel_id:
            await self.channel_layer.group_send(
                f"channel_{channel_id}",
                {
                    "type": "typing.update",
                    "data": {
                        "channel_id": channel_id,
                        "user_id": str(self.user.id),
                        "is_typing": True,
                    },
                },
            )

    async def handle_typing_stop(self, data: dict):
        channel_id = data.get("channel_id")
        if channel_id:
            await self.channel_layer.group_send(
                f"channel_{channel_id}",
                {
                    "type": "typing.update",
                    "data": {
                        "channel_id": channel_id,
                        "user_id": str(self.user.id),
                        "is_typing": False,
                    },
                },
            )

    # ─────────────────────────────────────────────
    # WebRTC signaling (voice/video)
    # ─────────────────────────────────────────────

    async def handle_call_offer(self, data: dict):
        await self.channel_layer.group_send(
            f"user_{data['target_user_id']}",
            {
                "type": "call.signal",
                "data": {
                    "signal": "offer",
                    "from_user_id": str(self.user.id),
                    "offer": data.get("offer"),
                    "context": data.get("context", "call"),
                },
            },
        )

    async def handle_call_answer(self, data: dict):
        await self.channel_layer.group_send(
            f"user_{data['target_user_id']}",
            {
                "type": "call.signal",
                "data": {
                    "signal": "answer",
                    "from_user_id": str(self.user.id),
                    "answer": data.get("answer"),
                    "context": data.get("context", "call"),
                },
            },
        )

    async def handle_call_ice_candidate(self, data: dict):
        await self.channel_layer.group_send(
            f"user_{data['target_user_id']}",
            {
                "type": "call.signal",
                "data": {
                    "signal": "ice_candidate",
                    "from_user_id": str(self.user.id),
                    "candidate": data.get("candidate"),
                    "context": data.get("context", "call"),
                },
            },
        )

    async def handle_call_end(self, data: dict):
        await self.channel_layer.group_send(
            f"user_{data['target_user_id']}",
            {
                "type": "call.signal",
                "data": {
                    "signal": "end",
                    "from_user_id": str(self.user.id),
                    "context": data.get("context", "call"),
                },
            },
        )

    # ─────────────────────────────────────────────
    # Connection presence (Redis-backed, shared across workers)
    # ─────────────────────────────────────────────

    def _presence_key(self) -> str:
        return f"presence_{self.workshop_id}"

    async def _presence_add(self, user_id: str) -> None:
        presence: set = await sync_to_async(cache.get)(self._presence_key()) or set()
        presence.add(user_id)
        await sync_to_async(cache.set)(self._presence_key(), presence, _PRESENCE_TTL)

    async def _presence_remove(self, user_id: str) -> None:
        presence: set = await sync_to_async(cache.get)(self._presence_key()) or set()
        presence.discard(user_id)
        await sync_to_async(cache.set)(self._presence_key(), presence, _PRESENCE_TTL)

    # ─────────────────────────────────────────────
    # Workshop voice presence (Redis-backed, shared across workers)
    # ─────────────────────────────────────────────

    def _voice_key(self) -> str:
        return f"voice_room_{self.workshop_id}"

    async def _room_get(self) -> dict:
        return await sync_to_async(cache.get)(self._voice_key()) or {}

    async def _room_set(self, room: dict) -> None:
        await sync_to_async(cache.set)(self._voice_key(), room, _VOICE_ROOM_TTL)

    async def handle_voice_join(self, data: dict):
        room = await self._room_get()
        room[str(self.user.id)] = {
            "id": str(self.user.id),
            "full_name": self.user.get_full_name() or self.user.email,
            "muted": bool(data.get("muted", False)),
        }
        await self._room_set(room)
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "voice.state",
                "data": {
                    "event": "join",
                    "user_id": str(self.user.id),
                    "participants": list(room.values()),
                },
            },
        )

    async def handle_voice_leave(self, data: dict):
        room = await self._room_get()
        room.pop(str(self.user.id), None)
        await self._room_set(room)
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "voice.state",
                "data": {
                    "event": "leave",
                    "user_id": str(self.user.id),
                    "participants": list(room.values()),
                },
            },
        )

    async def handle_voice_mute_update(self, data: dict):
        room = await self._room_get()
        uid = str(self.user.id)
        if uid in room:
            room[uid]["muted"] = bool(data.get("muted", False))
        await self._room_set(room)
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "voice.state",
                "data": {
                    "event": "mute_update",
                    "user_id": uid,
                    "participants": list(room.values()),
                },
            },
        )

    async def _voice_disconnect_cleanup(self):
        room = await self._room_get()
        if str(self.user.id) not in room:
            return
        room.pop(str(self.user.id), None)
        await self._room_set(room)
        await self.channel_layer.group_send(
            f"workshop_{self.workshop_id}",
            {
                "type": "voice.state",
                "data": {
                    "event": "leave",
                    "user_id": str(self.user.id),
                    "participants": list(room.values()),
                },
            },
        )

    # ─────────────────────────────────────────────
    # Outgoing event handlers (dispatched from channel layer)
    # ─────────────────────────────────────────────

    async def typing_update(self, event: dict):
        """Relay typing indicator — skip echo back to the originating user."""
        if event["data"]["user_id"] != str(self.user.id):
            await self.send_json({"type": "typing.update", "data": event["data"]})

    async def notification_send(self, event: dict):
        """Push a notification to this client."""
        await self.send_json({"type": "notification", "data": event["data"]})

    async def message_new(self, event: dict):
        """Broadcast a new message to all members of a channel room."""
        await self.send_json({"type": "message.new", "data": event["data"]})

    async def call_signal(self, event: dict):
        """Relay a WebRTC signaling event to the target user."""
        await self.send_json({"type": "call.signal", "data": event["data"]})

    async def voice_state(self, event: dict):
        """Broadcast voice channel presence update to all workshop members."""
        await self.send_json({"type": "voice.state", "data": event["data"]})

    async def ticket_activity(self, event: dict):
        """Relay ticket activity events (assigned, etc.) to all workshop clients."""
        await self.send_json({"type": "ticket.activity", "data": event["data"]})

    async def user_presence(self, event: dict):
        """Relay connection presence events (online/offline) to all workshop clients."""
        await self.send_json({"type": "user.presence", "data": event["data"]})

    # ─────────────────────────────────────────────
    # DB helpers
    # ─────────────────────────────────────────────

    @database_sync_to_async
    def _verify_membership(self, channel_id: str) -> bool:
        from apps.messaging.models import ChannelMember
        return ChannelMember.objects.filter(
            channel_id=channel_id,
            user=self.user,
            channel__workshop_id=self.user.workshop_id,
        ).exists()
