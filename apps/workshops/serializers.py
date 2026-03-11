from rest_framework import serializers

from .models import Workbench, Workshop


class WorkshopSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source="users.count", read_only=True)
    workbench_count = serializers.IntegerField(source="workbenches.count", read_only=True)

    class Meta:
        model = Workshop
        fields = [
            "id", "name", "slug", "description", "logo_url",
            "member_count", "workbench_count", "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at"]


class UpdateWorkshopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workshop
        fields = ["name", "description", "logo_url"]


class WorkbenchSerializer(serializers.ModelSerializer):
    ticket_count = serializers.SerializerMethodField()

    class Meta:
        model = Workbench
        fields = ["id", "name", "description", "color", "ticket_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_ticket_count(self, obj):
        return obj.tickets.count()
