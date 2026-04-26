import uuid

from django.conf import settings
from django.db import models

from apps.workshops.models import Workbench, Workshop


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        ASSIGNED = "ASSIGNED"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    class Urgency(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    urgency = models.CharField(
        max_length=20, choices=Urgency.choices, default=Urgency.MEDIUM, db_index=True
    )
    category = models.CharField(max_length=100, db_index=True)
    asset_id = models.CharField(max_length=100, blank=True)
    resolution = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    workshop = models.ForeignKey(
        Workshop, on_delete=models.CASCADE, related_name="tickets"
    )
    workbench = models.ForeignKey(
        Workbench, on_delete=models.PROTECT, related_name="tickets"
    )
    requestor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_tickets",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
        db_index=True,
    )

    class Meta:
        db_table = "tickets"
        ordering = ["-urgency", "-created_at"]
        indexes = [
            models.Index(fields=["workshop", "status"]),
            models.Index(fields=["workshop", "urgency"]),
            models.Index(fields=["workshop", "assignee"]),
        ]

    def __str__(self):
        return f"[{self.status}] {self.title}"


class TicketTag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="tags")

    class Meta:
        db_table = "ticket_tags"
        unique_together = [["ticket", "name"]]

    def __str__(self):
        return self.name


class WorkLog(models.Model):
    """A timestamped work entry added by a technician on a ticket."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField()
    time_spent_min = models.PositiveIntegerField(default=0, help_text="Time spent in minutes")
    created_at = models.DateTimeField(auto_now_add=True)

    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="work_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="work_logs",
    )

    class Meta:
        db_table = "work_logs"
        ordering = ["created_at"]

    def __str__(self):
        return f"WorkLog on {self.ticket_id} by {self.user_id}"
