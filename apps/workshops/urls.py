from django.urls import path
from . import views

# Mounted at /api/workshops/
urlpatterns = [
    path("create/", views.WorkshopCreateView.as_view(), name="workshop-create"),
    path("me/", views.WorkshopDetailView.as_view(), name="workshop-detail"),
    path("me/members/", views.WorkshopMembersView.as_view(), name="workshop-members"),
    path(
        "me/members/<uuid:user_id>/",
        views.DeactivateMemberView.as_view(),
        name="workshop-member-deactivate",
    ),
]
