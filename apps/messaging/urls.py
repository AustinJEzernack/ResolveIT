from django.urls import path
from . import views

urlpatterns = [
    path("channels/", views.ChannelListCreateView.as_view(), name="channel-list"),
    path(
        "channels/<uuid:channel_id>/messages/",
        views.MessageListCreateView.as_view(),
        name="message-list",
    ),
    path(
        "channels/<uuid:channel_id>/read/",
        views.MarkReadView.as_view(),
        name="message-read",
    ),
    path(
        "messages/<uuid:message_id>/",
        views.MessageDetailView.as_view(),
        name="message-detail",
    ),
]
