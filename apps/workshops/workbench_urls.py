from django.urls import path
from .views import WorkbenchDetailView, WorkbenchListCreateView

# Mounted at /api/workbenches/
urlpatterns = [
    path("", WorkbenchListCreateView.as_view(), name="workbench-list"),
    path("<uuid:pk>/", WorkbenchDetailView.as_view(), name="workbench-detail"),
]
