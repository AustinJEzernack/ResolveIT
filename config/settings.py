"""
Django settings for ResolveIT — IT Ticket Management System.
All secrets are loaded from environment via python-dotenv.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

# ─────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────
SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "False") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost").split(",")

AUTH_USER_MODEL = "accounts.User"

INSTALLED_APPS = [
    "jazzmin",              # must be before django.contrib.admin
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "drf_spectacular",
    # Local
    "apps.core",
    "apps.accounts",
    "apps.workshops",
    "apps.tickets",
    "apps.messaging",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # must be right after SecurityMiddleware
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "resolveit"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "OPTIONS": {"sslmode": "require"},
    }
}

# ─────────────────────────────────────────────
# Cache (Redis — shared across all Gunicorn workers)
# ─────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://localhost:6379"),
    }
}

# ─────────────────────────────────────────────
# Django Channels (WebSocket)
# ─────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.environ.get("REDIS_URL", "redis://localhost:6379")],
        },
    },
}

# ─────────────────────────────────────────────
# Django REST Framework
# ─────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
}

# ─────────────────────────────────────────────
# Simple JWT
# ─────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "15"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.accounts.serializers.CustomTokenObtainPairSerializer",
}

# ─────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# ─────────────────────────────────────────────
# Encryption
# ─────────────────────────────────────────────
MESSAGE_ENCRYPTION_KEY = os.environ["MESSAGE_ENCRYPTION_KEY"]

# ─────────────────────────────────────────────
# Static / i18n
# ─────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─────────────────────────────────────────────
# drf-spectacular (OpenAPI docs)
# ─────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "ResolveIT API",
    "DESCRIPTION": "Backend API for the ResolveIT IT ticket and messaging platform.",
    "VERSION": "1.0.0",
}

# ─────────────────────────────────────────────
# Jazzmin (Admin UI theme)
# ─────────────────────────────────────────────
JAZZMIN_SETTINGS = {
    # ── Branding ────────────────────────────
    "site_title": "ResolveIT Admin",
    "site_header": "ResolveIT",
    "site_brand": "ResolveIT",
    "site_logo": None,
    "login_logo": None,
    "site_icon": None,
    "welcome_sign": "Welcome to ResolveIT Admin",
    "copyright": "ResolveIT",

    # ── Top navigation search ────────────────
    "search_model": ["accounts.User", "tickets.Ticket"],

    # ── User avatar in top bar ───────────────
    "user_avatar": "avatar_url",

    # ── Top navigation links ─────────────────
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "API Docs", "url": "/api/docs/", "new_window": True},
        {"name": "Health", "url": "/health/", "new_window": True},
    ],

    # ── User menu (top-right dropdown) ───────
    "usermenu_links": [
        {"name": "API Docs", "url": "/api/docs/", "new_window": True},
    ],

    # ── Sidebar ──────────────────────────────
    "show_sidebar": True,
    "navigation_expanded": True,

    # Which models appear in the sidebar search
    "hide_apps": [],
    "hide_models": [],

    # Custom sidebar icons (Font Awesome 5 free)
    "icons": {
        "auth":                       "fas fa-users-cog",
        "auth.Group":                 "fas fa-users",
        "accounts.User":              "fas fa-user",
        "workshops.Workshop":         "fas fa-building",
        "workshops.Workbench":        "fas fa-table",
        "tickets.Ticket":             "fas fa-ticket-alt",
        "tickets.WorkLog":            "fas fa-clock",
        "tickets.TicketTag":          "fas fa-tag",
        "messaging.Channel":          "fas fa-comments",
        "messaging.Message":          "fas fa-envelope",
        "messaging.ChannelMember":    "fas fa-user-friends",
        "core.AuditLog":              "fas fa-history",
        "core.Notification":          "fas fa-bell",
        "token_blacklist.BlacklistedToken":  "fas fa-ban",
        "token_blacklist.OutstandingToken":  "fas fa-key",
    },
    "default_icon_parents": "fas fa-folder",
    "default_icon_children": "fas fa-circle",

    # ── Related modals ───────────────────────
    "related_modal_active": True,

    # ── UI Tweaks ────────────────────────────
    "custom_css": None,
    "custom_js": None,
    "use_google_fonts_cdn": True,
    "show_ui_builder": False,       # set True temporarily to design in-browser
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour":      "navbar-dark",
    "accent":            "accent-primary",
    "navbar":            "navbar-dark",
    "no_navbar_border":  False,
    "navbar_fixed":      True,
    "layout_boxed":      False,
    "footer_fixed":      False,
    "sidebar_fixed":     True,
    "sidebar":           "sidebar-dark-primary",
    "sidebar_nav_small_text":   False,
    "sidebar_disable_expand":   False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style":  False,
    "sidebar_nav_flat_style":    False,
    "theme":             "default",   # options: default, cerulean, cosmo, flatly, journal,
                                      #          litera, lumen, lux, materia, minty, pulse,
                                      #          sandstone, simplex, sketchy, slate, solar,
                                      #          spacelab, superhero, united, yeti
    "dark_mode_theme":   "darkly",
    "button_classes": {
        "primary":   "btn-primary",
        "secondary": "btn-secondary",
        "info":      "btn-info",
        "warning":   "btn-warning",
        "danger":    "btn-danger",
        "success":   "btn-success",
    },
}

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} [{levelname}] {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING"},
        "apps": {"handlers": ["console"], "level": "DEBUG" if DEBUG else "INFO"},
    },
}
