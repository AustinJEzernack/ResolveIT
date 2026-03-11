from django.contrib import admin

from .models import AuditLog, Notification


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "entity_type", "entity_id", "user", "ip_address", "created_at")
    list_filter = ("action", "entity_type")
    search_fields = ("user__email", "entity_type", "ip_address")
    readonly_fields = ("user", "action", "entity_type", "entity_id",
                       "workshop_id", "metadata", "ip_address", "user_agent", "created_at")

    # Audit logs are immutable — no add/change, only view/delete
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "user", "is_read", "created_at")
    list_filter = ("type", "is_read")
    search_fields = ("title", "body", "user__email")
    readonly_fields = ("created_at",)
