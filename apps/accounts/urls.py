from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("register/", views.RegisterWorkshopView.as_view(), name="auth-register"),
    path(
        "register-technician/",
        views.RegisterStandaloneTechnicianView.as_view(),
        name="auth-register-technician",
    ),
    path("technician/", views.RegisterTechnicianView.as_view(), name="auth-technician"),
    path("token/", views.LoginView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
]
