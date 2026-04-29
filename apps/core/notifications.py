"""
Notification service: persists a DB record and pushes it to the
user's personal WebSocket group via the Django Channels layer.
"""
import logging
import uuid

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification

logger = logging.getLogger(__name__)


def send_notification(
    *,
    user,
    notif_type: str,
    title: str,
    body: str,
    entity_type: str = "",
    entity_id: uuid.UUID | str | None = None,
) -> None:
    """Create a Notification record and push it to the user's socket group."""
    try:
        notification = Notification.objects.create(
            user=user,
            type=notif_type,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        _push_to_socket(user.id, notification)
    except Exception:
        logger.exception("Failed to send notification to user %s", user.id)


def _push_to_socket(user_id: uuid.UUID, notification: Notification) -> None:
    """Send notification event to the user's personal channel group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    payload = {
        "type": "notification.send",
        "data": {
            "id": str(notification.id),
            "type": notification.type,
            "title": notification.title,
            "body": notification.body,
            "entity_type": notification.entity_type,
            "entity_id": str(notification.entity_id) if notification.entity_id else None,
            "created_at": notification.created_at.isoformat(),
        },
    }
    try:
        async_to_sync(channel_layer.group_send)(f"user_{user_id}", payload)
    except Exception:
        logger.exception("Failed to push notification via WebSocket")


def broadcast_ticket_assigned(*, ticket, actor) -> None:
    """Broadcast a ticket.activity event to every client in the workshop WS group."""
    from django.utils import timezone

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    assignee = ticket.assignee  # lazy-loaded FK; refresh_from_db() already ran
    payload = {
        "type": "ticket.activity",
        "data": {
            "ticket_id": str(ticket.id),
            "ticket_title": ticket.title,
            "action": "assigned",
            "actor": {
                "id": str(actor.id),
                "full_name": actor.get_full_name() or actor.email,
            },
            "assignee": {
                "id": str(assignee.id),
                "full_name": assignee.get_full_name() or assignee.email,
            },
            "timestamp": timezone.now().isoformat(),
        },
    }
    try:
        async_to_sync(channel_layer.group_send)(
            f"workshop_{ticket.workshop_id}", payload
        )
    except Exception:
        logger.exception("Failed to broadcast ticket.activity for ticket %s", ticket.id)


def notify_ticket_created(ticket, workshop) -> None:
    """Notify all active technicians in a workshop about a new ticket."""
    from apps.accounts.models import User  # avoid circular import at module level

    technicians = User.objects.filter(
        workshop=workshop, role=User.Role.TECHNICIAN, is_active=True
    )
    for tech in technicians:
        send_notification(
            user=tech,
            notif_type=Notification.Type.TICKET_CREATED,
            title="New Ticket",
            body=f'A new ticket has been created: "{ticket.title}"',
            entity_type="ticket",
            entity_id=ticket.id,
        )
