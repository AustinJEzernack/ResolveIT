from django.contrib import admin

from .models import Ticket, TicketTag, WorkLog


class TicketTagInline(admin.TabularInline):
    model = TicketTag
    extra = 1


class WorkLogInline(admin.TabularInline):
    model = WorkLog
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "urgency", "category", "assignee", "workbench", "created_at")
    list_filter = ("status", "urgency", "category", "workbench", "workshop")
    search_fields = ("title", "description", "asset_id")
    readonly_fields = ("created_at", "updated_at", "closed_at")
    autocomplete_fields = ("requestor", "assignee", "workbench")
    inlines = [TicketTagInline, WorkLogInline]

    fieldsets = (
        ("Ticket Info", {"fields": ("title", "description", "category", "asset_id", "workbench")}),
        ("Status", {"fields": ("status", "urgency", "resolution", "closed_at")}),
        ("People", {"fields": ("requestor", "assignee")}),
        ("Workshop", {"fields": ("workshop",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ("ticket", "user", "time_spent_min", "created_at")
    list_filter = ("ticket__workshop",)
    search_fields = ("content", "ticket__title", "user__email")
    readonly_fields = ("created_at",)
