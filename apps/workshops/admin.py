from django.contrib import admin

from .models import Workbench, Workshop


@admin.register(Workshop)
class WorkshopAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Workbench)
class WorkbenchAdmin(admin.ModelAdmin):
    list_display = ("name", "workshop", "is_active", "created_at")
    list_filter = ("is_active", "workshop")
    search_fields = ("name", "workshop__name")
    readonly_fields = ("created_at", "updated_at")
