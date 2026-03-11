"""
Main WebSocket consumer for ResolveIT.

Handles:
  - Real-time message broadcasting
  - Typing indicators
  - In-app notification delivery
  - WebRTC signaling (offer/answer/ICE) for voice/video calls

Client event format:
  { "type": "<event_type>", "data": { ... } }
"""
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


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
        self.workshop_id = str(user.workshop_id)
        self._joined_channels: set[str] = set()

        # Personal room — for direct notifications and DMs
        await self.channel_layer.group_add(f"user_{user.id}", self.channel_name)
        # Workshop-wide room — for broadcast events
        await self.channel_layer.group_add(f"workshop_{self.workshop_id}", self.channel_name)

        await self.accept()
        logger.debug("WS connected: %s", user.id)

    async def disconnect(self, close_code):
        if not hasattr(self, "user"):
            return

        await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)
        await self.channel_layer.group_discard(
            f"workshop_{self.workshop_id}", self.channel_name
        )
        for channel_id in self._joined_channels:
            await self.channel_layer.group_discard(
                f"channel_{channel_id}", self.channel_name
            )
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
                },
            },
        )

    async def handle_call_end(self, data: dict):
        await self.channel_layer.group_send(
            f"user_{data['target_user_id']}",
            {
                "type": "call.signal",
                "data": {"signal": "end", "from_user_id": str(self.user.id)},
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
