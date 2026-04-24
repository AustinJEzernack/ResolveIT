from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.text import slugify

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
        # Generate slug from workshop name
        workshop = serializer.save()
        workshop.slug = slugify(workshop.name)
        workshop.save(update_fields=["slug"])
        
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
        return self.request.user.workshop

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
