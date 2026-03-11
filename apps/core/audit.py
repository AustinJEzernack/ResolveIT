"""
Audit logging helper.
Never raises — a failed audit log must not break the operation that triggered it.
"""
import logging
import uuid

from .models import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    *,
    user,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | str | None = None,
    workshop_id: uuid.UUID | str | None = None,
    metadata: dict | None = None,
    request=None,
) -> None:
    """
    Create an AuditLog record.
    All parameters are keyword-only to prevent accidental positional mistakes.
    """
    try:
        ip = None
        ua = ""
        if request is not None:
            ip = _get_client_ip(request)
            ua = request.META.get("HTTP_USER_AGENT", "")

        AuditLog.objects.create(
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            workshop_id=workshop_id or (user.workshop_id if user else None),
            metadata=metadata or {},
            ip_address=ip,
            user_agent=ua,
        )
    except Exception:
        logger.exception("Failed to write audit log")


def _get_client_ip(request) -> str | None:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
