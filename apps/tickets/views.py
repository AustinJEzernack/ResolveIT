import logging

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.core.audit import log_action
from apps.core.models import AuditLog, Notification
from apps.core.notifications import notify_ticket_created, send_notification
from apps.core.permissions import IsOwner

from .filters import TicketFilter
from .models import Ticket, WorkLog
from .serializers import (
    CreateTicketSerializer,
    TicketSerializer,
    UpdateTicketSerializer,
    WorkLogSerializer,
)

logger = logging.getLogger(__name__)


class TicketListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/  — list tickets in user's workshop (filterable)
    POST /api/tickets/  — create a new ticket
    """

    filterset_class = TicketFilter
    search_fields = ["title", "description", "asset_id"]
    ordering_fields = ["urgency", "created_at", "updated_at", "status"]
    ordering = ["-urgency", "-created_at"]

    def get_queryset(self):
        user = self.request.user
        if user.workshop_id is None:
            return (
                Ticket.objects.filter(assignee=user)
                .select_related("requestor", "assignee", "workbench")
                .prefetch_related("tags")
            )

        return (
            Ticket.objects.filter(workshop=user.workshop)
            .select_related("requestor", "assignee", "workbench")
            .prefetch_related("tags")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateTicketSerializer
        return TicketSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save(
            requestor=request.user,
            workshop=request.user.workshop,
        )

        log_action(
            user=request.user,
            action=AuditLog.Action.CREATE,
            entity_type="ticket",
            entity_id=ticket.id,
            metadata={"title": ticket.title},
            request=request,
        )
        notify_ticket_created(ticket, request.user.workshop)

        if ticket.assignee:
            send_notification(
                user=ticket.assignee,
                notif_type=Notification.Type.TICKET_ASSIGNED,
                title="Ticket Assigned to You",
                body=f'You have been assigned ticket: "{ticket.title}"',
                entity_type="ticket",
                entity_id=ticket.id,
            )

        return Response(
            {"status": "success", "data": {"ticket": TicketSerializer(ticket).data}},
            status=status.HTTP_201_CREATED,
        )


class TicketDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/tickets/<uuid>/"""

    def get_queryset(self):
        user = self.request.user
        if user.workshop_id is None:
            return (
                Ticket.objects.filter(assignee=user)
                .select_related("requestor", "assignee", "workbench")
                .prefetch_related("tags", "work_logs")
            )

        return (
            Ticket.objects.filter(workshop=user.workshop)
            .select_related("requestor", "assignee", "workbench")
            .prefetch_related("tags", "work_logs")
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateTicketSerializer
        return TicketSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        ticket = self.get_object()
        user = request.user

        # Technicians can only modify tickets they own or are assigned to
        if (
            user.role == "TECHNICIAN"
            and ticket.assignee_id != user.id
            and ticket.requestor_id != user.id
        ):
            return Response(
                {"status": "error", "message": "You do not have permission to update this ticket"},
                status=status.HTTP_403_FORBIDDEN,
            )

        old_status = ticket.status
        response = super().update(request, *args, **kwargs)

        ticket.refresh_from_db()
        log_action(
            user=user,
            action=AuditLog.Action.UPDATE,
            entity_type="ticket",
            entity_id=ticket.id,
            metadata={"changes": request.data},
            request=request,
        )

        # Notify requestor of status change (not if they made the change themselves)
        if ticket.status != old_status and ticket.requestor_id != user.id:
            send_notification(
                user=ticket.requestor,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket Updated",
                body=f'Ticket "{ticket.title}" status changed to {ticket.status}',
                entity_type="ticket",
                entity_id=ticket.id,
            )

        response.data = {"status": "success", "data": {"ticket": response.data}}
        return response

    def destroy(self, request, *args, **kwargs):
        ticket = self.get_object()
        user = request.user

        if (
            user.role != "OWNER"
            and ticket.assignee_id != user.id
            and ticket.requestor_id != user.id
        ):
            return Response(
                {"status": "error", "message": "You do not have permission to complete this ticket"},
                status=status.HTTP_403_FORBIDDEN,
            )

        log_action(
            user=user,
            action=AuditLog.Action.DELETE,
            entity_type="ticket",
            entity_id=ticket.id,
            request=request,
        )
        ticket.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkLogListCreateView(generics.ListCreateAPIView):
    """GET / POST /api/tickets/<ticket_id>/work-logs/"""

    serializer_class = WorkLogSerializer

    def _get_ticket(self):
        return Ticket.objects.get(
            id=self.kwargs["ticket_id"],
            workshop=self.request.user.workshop,
        )

    def get_queryset(self):
        return WorkLog.objects.filter(
            ticket_id=self.kwargs["ticket_id"],
            ticket__workshop=self.request.user.workshop,
        ).select_related("user")

    def perform_create(self, serializer):
        ticket = self._get_ticket()
        serializer.save(ticket=ticket, user=self.request.user)
