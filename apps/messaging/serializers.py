from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer

from .models import Channel, ChannelMember, Message


class ChannelMemberSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = ChannelMember
        fields = ["id", "user", "is_admin", "joined_at"]


class ChannelSerializer(serializers.ModelSerializer):
    memberships = ChannelMemberSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = ["id", "name", "type", "is_encrypted", "memberships", "last_message", "updated_at"]

    def get_last_message(self, obj):
        msg = obj.messages.filter(is_deleted=False).order_by("-created_at").first()
        if msg:
            return {
                "id": str(msg.id),
                "content": msg.content,
                "sender": PublicUserSerializer(msg.sender).data,
                "created_at": msg.created_at.isoformat(),
            }
        return None


class CreateChannelSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=Channel.Type.choices)
    member_ids = serializers.ListField(child=serializers.UUIDField(), min_length=0, default=list)
    is_encrypted = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["type"] == Channel.Type.DIRECT and len(attrs["member_ids"]) != 1:
            raise serializers.ValidationError(
                {"member_ids": "Direct channels require exactly one other member."}
            )
        if attrs["type"] != Channel.Type.DIRECT and not attrs.get("name"):
            raise serializers.ValidationError(
                {"name": "Name is required for non-DM channels."}
            )
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    sender = PublicUserSerializer(read_only=True)
    read_by = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "content", "is_encrypted", "edited_at",
            "created_at", "reply_to_id", "sender", "read_by",
        ]

    def get_read_by(self, obj):
        return [
            {"user_id": str(r.user_id), "read_at": r.read_at.isoformat()}
            for r in obj.read_receipts.all()
        ]


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=10000)
    reply_to_id = serializers.UUIDField(required=False, allow_null=True)


class EditMessageSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=10000)


class ReadReceiptSerializer(serializers.Serializer):
    message_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
