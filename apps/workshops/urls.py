from django.urls import path
from . import views
from apps.tickets.views import PublicTicketIntakeView

# Mounted at /api/workshops/
urlpatterns = [
    path("create/", views.WorkshopCreateView.as_view(), name="workshop-create"),
    path("join/", views.JoinWorkshopView.as_view(), name="workshop-join"),
    path("me/", views.WorkshopDetailView.as_view(), name="workshop-detail"),
    path(
        "available-members/",
        views.AvailableUsersView.as_view(),
        name="workshop-available-members",
    ),
    path("leaderboard/", views.WorkshopLeaderboardView.as_view(), name="workshop-leaderboard"),
    path("presence/", views.WorkshopPresenceView.as_view(), name="workshop-presence"),
    path("me/members/", views.WorkshopMembersView.as_view(), name="workshop-members"),
    path(
        "me/members/<uuid:user_id>/assign/",
        views.AddMemberView.as_view(),
        name="workshop-member-assign",
    ),
    path(
        "me/members/<uuid:user_id>/",
        views.DeactivateMemberView.as_view(),
        name="workshop-member-deactivate",
    ),
    path(
        "<slug:slug>/intake/",
        PublicTicketIntakeView.as_view(),
        name="workshop-public-intake",
    ),
]
