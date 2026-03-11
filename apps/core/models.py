"""
Shared system models: AuditLog and Notification.
These are decoupled from business apps via lazy string FK references.
"""
import uuid

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        ASSIGN = "ASSIGN", "Assign"
        RESOLVE = "RESOLVE", "Resolve"
        CLOSE = "CLOSE", "Close"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    workshop_id = models.UUIDField(null=True, blank=True, db_index=True)
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        default_permissions = ()

    def __str__(self):
        return f"{self.action} {self.entity_type} by {self.user_id}"


class Notification(models.Model):
    class Type(models.TextChoices):
        TICKET_CREATED = "TICKET_CREATED", "Ticket Created"
        TICKET_ASSIGNED = "TICKET_ASSIGNED", "Ticket Assigned"
        TICKET_UPDATED = "TICKET_UPDATED", "Ticket Updated"
        TICKET_RESOLVED = "TICKET_RESOLVED", "Ticket Resolved"
        TICKET_CLOSED = "TICKET_CLOSED", "Ticket Closed"
        MESSAGE_RECEIVED = "MESSAGE_RECEIVED", "Message Received"
        WORKBENCH_ADDED = "WORKBENCH_ADDED", "Workbench Added"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=200)
    body = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    entity_type = models.CharField(max_length=50, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.type} → {self.user_id}"
