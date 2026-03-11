from django.urls import path
from . import views

urlpatterns = [
    path("", views.TicketListCreateView.as_view(), name="ticket-list"),
    path("<uuid:pk>/", views.TicketDetailView.as_view(), name="ticket-detail"),
    path(
        "<uuid:ticket_id>/work-logs/",
        views.WorkLogListCreateView.as_view(),
        name="ticket-worklogs",
    ),
]
