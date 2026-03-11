import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.audit import log_action
from apps.core.encryption import EncryptedPayload, decrypt_message, encrypt_message
from apps.core.models import AuditLog

from .models import Channel, ChannelMember, Message, MessageReadReceipt
from .serializers import (
    ChannelSerializer,
    CreateChannelSerializer,
    EditMessageSerializer,
    MessageSerializer,
    ReadReceiptSerializer,
    SendMessageSerializer,
)

logger = logging.getLogger(__name__)


class ChannelListCreateView(APIView):
    """
    GET  /api/messaging/channels/ — channels the user is a member of
    POST /api/messaging/channels/ — create a channel (or return existing DM)
    """

    def get(self, request):
        channels = (
            Channel.objects.filter(
                workshop=request.user.workshop,
                memberships__user=request.user,
            )
            .prefetch_related("memberships__user")
            .distinct()
        )
        return Response(
            {"status": "success", "data": {"channels": ChannelSerializer(channels, many=True).data}}
        )

    @transaction.atomic
    def post(self, request):
        serializer = CreateChannelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        workshop = request.user.workshop
        all_member_ids = [str(request.user.id)] + [str(m) for m in data["member_ids"]]

        # Ensure all members belong to this workshop
        members = User.objects.filter(
            id__in=all_member_ids, workshop=workshop, is_active=True
        )
        if members.count() != len(all_member_ids):
            return Response(
                {"status": "error", "message": "One or more members not found in your workshop"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # For DMs, return existing channel if one already exists between these two users
        if data["type"] == Channel.Type.DIRECT:
            other_id = str(data["member_ids"][0])
            existing = (
                Channel.objects.filter(
                    workshop=workshop,
                    type=Channel.Type.DIRECT,
                    memberships__user_id=request.user.id,
                )
                .filter(memberships__user_id=other_id)
                .first()
            )
            if existing:
                return Response(
                    {"status": "success", "data": {"channel": ChannelSerializer(existing).data}}
                )

        channel = Channel.objects.create(
            name=data.get("name", ""),
            type=data["type"],
            is_encrypted=data["is_encrypted"],
            workshop=workshop,
        )
        ChannelMember.objects.bulk_create([
            ChannelMember(
                channel=channel,
                user_id=uid,
                is_admin=(str(uid) == str(request.user.id)),
            )
            for uid in all_member_ids
        ])

        return Response(
            {"status": "success", "data": {"channel": ChannelSerializer(channel).data}},
            status=status.HTTP_201_CREATED,
        )


class MessageListCreateView(APIView):
    """
    GET  /api/messaging/channels/<channel_id>/messages/?cursor=<iso>&limit=50
    POST /api/messaging/channels/<channel_id>/messages/
    """

    def _get_channel(self, request, channel_id):
        """Return (channel, error_response). One of them will be None."""
        try:
            channel = Channel.objects.get(id=channel_id, workshop=request.user.workshop)
        except Channel.DoesNotExist:
            return None, Response(
                {"status": "error", "message": "Channel not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not channel.memberships.filter(user=request.user).exists():
            return None, Response(
                {"status": "error", "message": "You are not a member of this channel"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return channel, None

    def get(self, request, channel_id):
        channel, err = self._get_channel(request, channel_id)
        if err:
            return err

        cursor = request.query_params.get("cursor")
        limit = min(int(request.query_params.get("limit", 50)), 100)

        qs = channel.messages.filter(is_deleted=False).select_related(
            "sender"
        ).prefetch_related("read_receipts")

        if cursor:
            qs = qs.filter(created_at__lt=cursor)

        messages = list(qs.order_by("-created_at")[: limit + 1])
        has_more = len(messages) > limit
        messages = messages[:limit]

        result = []
        for msg in messages:
            d = MessageSerializer(msg).data
            if msg.is_encrypted and msg.encryption_iv:
                try:
                    d["content"] = decrypt_message(
                        EncryptedPayload(ciphertext=msg.content, iv=msg.encryption_iv)
                    )
                except Exception:
                    d["content"] = "[Decryption failed]"
            result.append(d)

        next_cursor = (
            messages[-1].created_at.isoformat() if has_more and messages else None
        )

        return Response({
            "status": "success",
            "data": {"messages": result, "has_more": has_more, "next_cursor": next_cursor},
        })

    def post(self, request, channel_id):
        channel, err = self._get_channel(request, channel_id)
        if err:
            return err

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plain_content = serializer.validated_data["content"]

        content = plain_content
        iv = ""
        if channel.is_encrypted:
            payload = encrypt_message(plain_content)
            content = payload.ciphertext
            iv = payload.iv

        message = Message.objects.create(
            channel=channel,
            sender=request.user,
            content=content,
            is_encrypted=channel.is_encrypted,
            encryption_iv=iv,
            reply_to_id=serializer.validated_data.get("reply_to_id"),
        )
        Channel.objects.filter(id=channel_id).update(updated_at=message.created_at)

        log_action(
            user=request.user,
            action=AuditLog.Action.CREATE,
            entity_type="message",
            entity_id=message.id,
            request=request,
        )

        data = MessageSerializer(message).data
        data["content"] = plain_content  # return plaintext to the sender

        return Response(
            {"status": "success", "data": {"message": data}},
            status=status.HTTP_201_CREATED,
        )


class MarkReadView(APIView):
    """POST /api/messaging/channels/<channel_id>/read/"""

    def post(self, request, channel_id):
        serializer = ReadReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        MessageReadReceipt.objects.bulk_create(
            [
                MessageReadReceipt(message_id=mid, user=request.user)
                for mid in serializer.validated_data["message_ids"]
            ],
            ignore_conflicts=True,
        )
        return Response({"status": "success"})


class MessageDetailView(APIView):
    """PATCH / DELETE /api/messaging/messages/<message_id>/"""

    def _get_message(self, request, message_id):
        try:
            return Message.objects.get(
                id=message_id,
                channel__workshop=request.user.workshop,
            )
        except Message.DoesNotExist:
            return None

    def patch(self, request, message_id):
        message = self._get_message(request, message_id)
        if not message:
            return Response({"status": "error", "message": "Message not found"}, status=404)
        if message.sender_id != request.user.id:
            return Response({"status": "error", "message": "Cannot edit another user's message"}, status=403)
        if message.is_deleted:
            return Response({"status": "error", "message": "Cannot edit a deleted message"}, status=400)

        serializer = EditMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plain = serializer.validated_data["content"]

        if message.is_encrypted:
            payload = encrypt_message(plain)
            message.content = payload.ciphertext
            message.encryption_iv = payload.iv
        else:
            message.content = plain

        message.edited_at = timezone.now()
        message.save(update_fields=["content", "encryption_iv", "edited_at"])

        return Response({"status": "success", "data": {"content": plain}})

    def delete(self, request, message_id):
        message = self._get_message(request, message_id)
        if not message:
            return Response({"status": "error", "message": "Message not found"}, status=404)
        if message.sender_id != request.user.id and request.user.role != "OWNER":
            return Response({"status": "error", "message": "Cannot delete this message"}, status=403)

        message.is_deleted = True
        message.content = "[Message deleted]"
        message.save(update_fields=["is_deleted", "content"])
        return Response(status=status.HTTP_204_NO_CONTENT)
