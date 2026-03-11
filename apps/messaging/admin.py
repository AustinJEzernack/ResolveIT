from django.contrib import admin

from .models import Channel, ChannelMember, Message, MessageReadReceipt


class ChannelMemberInline(admin.TabularInline):
    model = ChannelMember
    extra = 1
    readonly_fields = ("joined_at",)


@admin.register(Channel)
class ChannelAdmin(admin.ModelAdmin):
    list_display = ("__str__", "type", "is_encrypted", "workshop", "updated_at")
    list_filter = ("type", "is_encrypted", "workshop")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [ChannelMemberInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "channel", "is_encrypted", "is_deleted", "created_at")
    list_filter = ("is_encrypted", "is_deleted", "channel__workshop")
    search_fields = ("content", "sender__email")
    readonly_fields = ("created_at", "updated_at", "edited_at")
