import uuid

from django.conf import settings
from django.db import models

from apps.workshops.models import Workshop


class Channel(models.Model):
    class Type(models.TextChoices):
        DIRECT = "DIRECT", "Direct Message"
        PRIVATE = "PRIVATE", "Private Channel"
        PUBLIC = "PUBLIC", "Public Channel"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, blank=True)  # blank for DIRECT channels
    type = models.CharField(max_length=10, choices=Type.choices, db_index=True)
    is_encrypted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    workshop = models.ForeignKey(
        Workshop, on_delete=models.CASCADE, related_name="channels"
    )

    class Meta:
        db_table = "channels"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name or f"DM/{self.id}"


class ChannelMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_admin = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="channel_memberships",
    )

    class Meta:
        db_table = "channel_members"
        unique_together = [["channel", "user"]]
        indexes = [models.Index(fields=["channel", "user"])]

    def __str__(self):
        return f"{self.user_id} in {self.channel_id}"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Plaintext, or hex-encoded AES-256-GCM ciphertext for encrypted channels
    content = models.TextField()
    is_encrypted = models.BooleanField(default=False)
    # Hex-encoded AES-GCM IV, only populated when is_encrypted=True
    encryption_iv = models.CharField(max_length=64, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_messages",
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )

    class Meta:
        db_table = "messages"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["channel", "created_at"])]

    def __str__(self):
        return f"Message {self.id} in {self.channel_id}"


class MessageReadReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    read_at = models.DateTimeField(auto_now_add=True)

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="read_receipts"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="read_receipts",
    )

    class Meta:
        db_table = "message_read_receipts"
        unique_together = [["message", "user"]]
