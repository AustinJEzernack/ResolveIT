from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.workshops.models import Workshop

from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Inject role and workshop_id into the JWT payload on login."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["workshop_id"] = str(user.workshop_id) if user.workshop_id else None
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Stamp last active on every login
        self.user.last_active_at = timezone.now()
        self.user.save(update_fields=["last_active_at"])
        return data


class PublicUserSerializer(serializers.ModelSerializer):
    """Safe user representation — no password or sensitive fields."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name",
            "full_name", "role", "avatar_url", "last_active_at",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()


class RegisterWorkshopSerializer(serializers.Serializer):
    """Validate the combined workshop + owner registration payload."""

    workshop_name = serializers.CharField(min_length=2, max_length=100)
    workshop_slug = serializers.SlugField(min_length=2, max_length=50)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(min_length=1, max_length=50)
    last_name = serializers.CharField(min_length=1, max_length=50)

    def validate_workshop_slug(self, value):
        if Workshop.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value.lower()

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    @transaction.atomic
    def create(self, validated_data):
        workshop = Workshop.objects.create(
            name=validated_data["workshop_name"],
            slug=validated_data["workshop_slug"],
        )
        owner = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=User.Role.OWNER,
            workshop=workshop,
        )
        return owner, workshop


class RegisterTechnicianSerializer(serializers.ModelSerializer):
    """Owner-only: add a Technician to the owner's workshop."""

    password = serializers.CharField(min_length=8, write_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name"]

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        workshop = self.context["request"].user.workshop
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=User.Role.TECHNICIAN,
            workshop=workshop,
        )


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "avatar_url"]
