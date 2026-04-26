from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.workshops.serializers import WorkbenchSerializer

from .models import Ticket, TicketTag, WorkLog


class TicketTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketTag
        fields = ["name"]


class WorkLogSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = WorkLog
        fields = ["id", "content", "time_spent_min", "user", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class TicketSerializer(serializers.ModelSerializer):
    requestor = PublicUserSerializer(read_only=True)
    assignee = PublicUserSerializer(read_only=True)
    workbench = WorkbenchSerializer(read_only=True)
    tags = TicketTagSerializer(many=True, read_only=True)
    work_log_count = serializers.IntegerField(
        source="work_logs.count", read_only=True, default=0
    )

    class Meta:
        model = Ticket
        fields = [
            "id", "title", "description", "status", "urgency", "category",
            "asset_id", "resolution", "closed_at", "created_at", "updated_at",
            "requestor", "assignee", "workbench", "tags", "work_log_count",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at", "closed_at", "requestor", "workbench",
        ]


class CreateTicketSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, write_only=True
    )
    workbench_id = serializers.UUIDField(write_only=True)
    assignee_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Ticket
        fields = [
            "title", "description", "urgency", "category",
            "asset_id", "workbench_id", "assignee_id", "tags",
        ]

    def validate_workbench_id(self, value):
        from apps.workshops.models import Workbench
        workshop = self.context["request"].user.workshop
        if not Workbench.objects.filter(id=value, workshop=workshop, is_active=True).exists():
            raise serializers.ValidationError("Workbench not found in your workshop.")
        return value

    def validate_assignee_id(self, value):
        if value is None:
            return value
        from apps.accounts.models import User
        workshop = self.context["request"].user.workshop
        if not User.objects.filter(id=value, workshop=workshop, is_active=True).exists():
            raise serializers.ValidationError("Assignee not found in your workshop.")
        return value

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        ticket = Ticket.objects.create(**validated_data)
        if tags:
            TicketTag.objects.bulk_create(
                [TicketTag(ticket=ticket, name=t) for t in tags]
            )
        return ticket


class UpdateTicketSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_null=True,
        write_only=True,
    )
    assignee_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Ticket
        fields = [
            "title", "description", "status", "urgency",
            "category", "asset_id", "assignee_id", "resolution", "tags",
        ]

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", None))
        resolution = attrs.get("resolution", getattr(self.instance, "resolution", ""))
        if status in (Ticket.Status.RESOLVED, Ticket.Status.CLOSED) and not str(resolution).strip():
            raise serializers.ValidationError(
                {"resolution": "Resolution is required when status is RESOLVED or CLOSED."}
            )
        return attrs

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)

        # Auto-stamp closed_at when entering a terminal state
        new_status = validated_data.get("status")
        if new_status in (Ticket.Status.RESOLVED, Ticket.Status.CLOSED):
            validated_data["closed_at"] = timezone.now()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tags is not None:
            instance.tags.all().delete()
            TicketTag.objects.bulk_create(
                [TicketTag(ticket=instance, name=t) for t in tags]
            )

        return instance
