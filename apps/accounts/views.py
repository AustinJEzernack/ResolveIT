import logging

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.audit import log_action
from apps.core.models import AuditLog
from apps.core.permissions import IsOwner

from .models import User
from .serializers import (
    CustomTokenObtainPairSerializer,
    PublicUserSerializer,
    RegisterStandaloneTechnicianSerializer,
    RegisterTechnicianSerializer,
    RegisterWorkshopSerializer,
    UpdateProfileSerializer,
)

logger = logging.getLogger(__name__)


class RegisterWorkshopView(APIView):
    """
    POST /api/auth/register/
    Creates a Workshop and its Owner account atomically.
    Returns a JWT token pair.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterWorkshopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        owner, workshop = serializer.save()

        log_action(
            user=owner,
            action=AuditLog.Action.CREATE,
            entity_type="workshop",
            entity_id=workshop.id,
            workshop_id=workshop.id,
            request=request,
        )

        refresh = RefreshToken.for_user(owner)
        refresh["role"] = owner.role
        refresh["workshop_id"] = str(owner.workshop_id)
        refresh["email"] = owner.email

        return Response(
            {
                "status": "success",
                "data": {
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                    "user": PublicUserSerializer(owner).data,
                    "workshop": {
                        "id": str(workshop.id),
                        "name": workshop.name,
                        "slug": workshop.slug,
                    },
                },
            },
            status=status.HTTP_201_CREATED,
        )


class RegisterTechnicianView(generics.CreateAPIView):
    """
    POST /api/auth/technician/
    Owner-only: invite a Technician to the workshop.
    """

    serializer_class = RegisterTechnicianSerializer
    permission_classes = [IsOwner]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        log_action(
            user=request.user,
            action=AuditLog.Action.CREATE,
            entity_type="user",
            entity_id=user.id,
            request=request,
        )

        return Response(
            {"status": "success", "data": {"user": PublicUserSerializer(user).data}},
            status=status.HTTP_201_CREATED,
        )


class RegisterStandaloneTechnicianView(APIView):
    """
    POST /api/auth/register-technician/
    Public signup for technicians without a workshop.
    Returns a JWT token pair.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStandaloneTechnicianSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        log_action(
            user=user,
            action=AuditLog.Action.CREATE,
            entity_type="user",
            entity_id=user.id,
            workshop_id=None,
            request=request,
        )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["workshop_id"] = None
        refresh["email"] = user.email

        return Response(
            {
                "status": "success",
                "data": {
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                    "user": PublicUserSerializer(user).data,
                    "workshop": None,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """POST /api/auth/token/ — returns access + refresh tokens."""

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                user = User.objects.get(email=request.data.get("email", "").lower())
                log_action(
                    user=user,
                    action=AuditLog.Action.LOGIN,
                    entity_type="user",
                    entity_id=user.id,
                    request=request,
                )
            except User.DoesNotExist:
                pass
        return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the provided refresh token via Simple JWT's token_blacklist.
    """

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response(
                {"status": "error", "message": "refresh_token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass  # Already blacklisted or invalid — still success from client's POV

        log_action(
            user=request.user,
            action=AuditLog.Action.LOGOUT,
            entity_type="user",
            entity_id=request.user.id,
            request=request,
        )
        return Response({"status": "success", "message": "Logged out successfully"})


class MeView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/auth/me/ — view or update own profile."""

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateProfileSerializer
        return PublicUserSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)
