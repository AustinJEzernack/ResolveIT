"""
WSGI config for ResolveIT.
Used by traditional WSGI servers (gunicorn, etc.).
For WebSocket support, use asgi.py with uvicorn instead.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()
