from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import cache
from django.http import Http404
from django.utils.text import slugify
from uuid import UUID, uuid4

from apps.accounts.models import User
from apps.accounts.serializers import PublicUserSerializer
from apps.core.permissions import IsOwner
from apps.messaging.models import Channel, ChannelMember

from .models import Workbench, Workshop
from .serializers import UpdateWorkshopSerializer, WorkbenchSerializer, WorkshopSerializer


# ─────────────────────────────────────────────
# Workshop views
# ─────────────────────────────────────────────

class WorkshopCreateView(generics.CreateAPIView):
    """POST /api/workshops/create/ — create a new workshop and assign user as owner."""

    serializer_class = WorkshopSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        workshop = serializer.save()
        base_slug = slugify(workshop.name) or str(uuid4())[:8]
        slug = base_slug
        if Workshop.objects.filter(slug=slug).exclude(id=workshop.id).exists():
            slug = f"{base_slug}-{str(uuid4())[:8]}"
        workshop.slug = slug
        workshop.save(update_fields=["slug"])

        # Create default "General" workbench
        Workbench.objects.create(workshop=workshop, name="General")

        # Assign current user as owner of this workshop
        user = self.request.user
        user.workshop = workshop
        user.role = User.Role.OWNER
        user.save(update_fields=["workshop", "role"])


class WorkshopDetailView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/workshops/me/ — current user's workshop."""

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateWorkshopSerializer
        return WorkshopSerializer

    def get_object(self):
        workshop = self.request.user.workshop
        if workshop is None:
            raise Http404
        return workshop

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


class WorkshopMembersView(generics.ListAPIView):
    """GET /api/workshops/me/members/ — all active members in the workshop."""

    serializer_class = PublicUserSerializer

    def get_queryset(self):
        return User.objects.filter(
            workshop=self.request.user.workshop, is_active=True
        ).order_by("first_name")


class AvailableUsersView(generics.ListAPIView):
    """GET /api/workshops/available-members/ — active non-owner users outside this workshop."""

    serializer_class = PublicUserSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        return User.objects.filter(is_active=True).exclude(
            id=self.request.user.id
        ).exclude(
            workshop=self.request.user.workshop
        ).exclude(
            role=User.Role.OWNER
        ).order_by("first_name", "last_name", "email")


class AddMemberView(APIView):
    """POST /api/workshops/me/members/<user_id>/assign/ — add an existing user to the current workshop."""

    permission_classes = [IsOwner]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role == User.Role.OWNER:
            return Response(
                {"status": "error", "message": "Owners cannot be reassigned"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.workshop_id == request.user.workshop_id:
            return Response(
                {"status": "error", "message": "User is already in your workshop"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.workshop = request.user.workshop
        user.role = User.Role.TECHNICIAN
        user.save(update_fields=["workshop", "role"])

        # Add the new member to all existing workbench channels in this workshop
        channels = Channel.objects.filter(workshop=request.user.workshop)
        ChannelMember.objects.bulk_create(
            [ChannelMember(channel=channel, user=user, is_admin=False) for channel in channels],
            ignore_conflicts=True,
        )

        return Response(
            {
                "status": "success",
                "message": "Member added to workshop",
                "data": {"user": PublicUserSerializer(user).data},
            },
            status=status.HTTP_200_OK,
        )


class DeactivateMemberView(APIView):
    """DELETE /api/workshops/me/members/<user_id>/ — owner deactivates a member."""

    permission_classes = [IsOwner]

    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, workshop=request.user.workshop)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "User not found in your workshop"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role == User.Role.OWNER:
            return Response(
                {"status": "error", "message": "Cannot deactivate the workshop owner"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"status": "success", "message": "Member deactivated"})


class JoinWorkshopView(APIView):
    """POST /api/workshops/join/ — technician joins workshop by workshop id."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.TECHNICIAN:
            return Response(
                {"status": "error", "message": "Only technicians can join by workshop ID"},
                status=status.HTTP_403_FORBIDDEN,
            )

        workshop_id = request.data.get("workshop_id")
        try:
            workshop_uuid = UUID(str(workshop_id))
        except (TypeError, ValueError):
            return Response(
                {"status": "error", "message": "Invalid workshop ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            workshop = Workshop.objects.get(id=workshop_uuid, is_active=True)
        except Workshop.DoesNotExist:
            return Response(
                {"status": "error", "message": "Workshop not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.workshop_id == workshop.id:
            return Response(
                {"status": "error", "message": "You are already in this workshop"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        user.workshop = workshop
        user.role = User.Role.TECHNICIAN
        user.save(update_fields=["workshop", "role"])

        channels = Channel.objects.filter(workshop=workshop)
        ChannelMember.objects.bulk_create(
            [ChannelMember(channel=channel, user=user, is_admin=False) for channel in channels],
            ignore_conflicts=True,
        )

        return Response(
            {
                "status": "success",
                "message": "Joined workshop successfully",
                "data": {"workshop": WorkshopSerializer(workshop).data},
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────
# Leaderboard view
# ─────────────────────────────────────────────

class WorkshopLeaderboardView(APIView):
    """GET /api/workshops/leaderboard/ — weekly XP rankings for the current workshop."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import datetime, timedelta, timezone as tz
        from apps.tickets.models import Ticket

        user = request.user
        if not user.workshop_id:
            return Response({"error": "Not in a workshop"}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now(tz.utc)
        # Monday 00:00 UTC of the current week
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        members = User.objects.filter(workshop_id=user.workshop_id, is_active=True)

        entries = []
        for member in members:
            resolved = Ticket.objects.filter(
                workshop_id=user.workshop_id,
                assignee=member,
                status__in=["RESOLVED", "CLOSED"],
                updated_at__gte=week_start,
            ).count()
            # Tickets assigned to them this week that are not yet resolved
            assigned = Ticket.objects.filter(
                workshop_id=user.workshop_id,
                assignee=member,
                created_at__gte=week_start,
            ).exclude(status__in=["RESOLVED", "CLOSED"]).count()
            xp = resolved * 100 + assigned * 10
            entries.append({
                "user_id": str(member.id),
                "full_name": member.get_full_name() or member.email,
                "xp": xp,
                "tickets_resolved": resolved,
                "level": xp // 500 + 1,
            })

        # Stable sort: XP desc, then name asc
        entries.sort(key=lambda e: (-e["xp"], e["full_name"]))
        for i, entry in enumerate(entries):
            entry["rank"] = i + 1

        elapsed_days = max((now - week_start).total_seconds() / 86400, 0.01)
        total_resolved = sum(e["tickets_resolved"] for e in entries)
        avg_per_day = round(total_resolved / elapsed_days, 1)

        current_user_rank = next(
            (e["rank"] for e in entries if e["user_id"] == str(user.id)),
            len(entries),
        )
        leader = entries[0] if entries else None

        return Response({
            "entries": entries,
            "summary": {
                "leader_name": leader["full_name"] if leader else "—",
                "total_resolved": total_resolved,
                "avg_per_day": avg_per_day,
                "current_user_rank": current_user_rank,
                "total_members": len(entries),
            },
            "week_start": week_start.isoformat(),
        })


# ─────────────────────────────────────────────
# Presence view
# ─────────────────────────────────────────────

class WorkshopPresenceView(APIView):
    """GET /api/workshops/presence/ — count of online users in the caller's workshop."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        workshop_id = request.user.workshop_id
        if not workshop_id:
            return Response({"online_count": 0})
        presence: set = cache.get(f"presence_{workshop_id}") or set()
        return Response({"online_count": len(presence)})


# ─────────────────────────────────────────────
# Workbench views
# ─────────────────────────────────────────────

class WorkbenchListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/workbenches/ — list active workbenches
    POST /api/workbenches/ — create one (owner only)
    """

    serializer_class = WorkbenchSerializer

    def get_queryset(self):
        return Workbench.objects.filter(
            workshop=self.request.user.workshop, is_active=True
        )

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        workbench = serializer.save(workshop=self.request.user.workshop)

        # Auto-create a matching PUBLIC channel so workbench chat works immediately
        workshop = self.request.user.workshop
        channel = Channel.objects.create(
            name=workbench.name,
            type=Channel.Type.PUBLIC,
            is_encrypted=False,
            workshop=workshop,
        )
        members = User.objects.filter(workshop=workshop, is_active=True)
        ChannelMember.objects.bulk_create(
            [
                ChannelMember(
                    channel=channel,
                    user=member,
                    is_admin=(member.id == self.request.user.id),
                )
                for member in members
            ],
            ignore_conflicts=True,
        )


class WorkbenchDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/workbenches/<id>/"""

    serializer_class = WorkbenchSerializer

    def get_queryset(self):
        return Workbench.objects.filter(
            workshop=self.request.user.workshop, is_active=True
        )

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        # Soft-delete to preserve ticket history
        workbench = self.get_object()
        workbench.is_active = False
        workbench.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
