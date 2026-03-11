from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    # API routes
    path("api/auth/", include("apps.accounts.urls")),
    path("api/workshops/", include("apps.workshops.urls")),
    path("api/workbenches/", include("apps.workshops.workbench_urls")),
    path("api/tickets/", include("apps.tickets.urls")),
    path("api/messaging/", include("apps.messaging.urls")),
    # OpenAPI docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    # Health check
    path("health/", health_check, name="health"),
]
