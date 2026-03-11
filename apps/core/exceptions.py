"""
Custom DRF exception handler — consistent JSON envelope for all errors.
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            "status": "error",
            "message": _extract_message(response.data),
        }
        return response

    # Unhandled exception — log it and return a generic 500
    logger.exception("Unhandled exception", exc_info=exc)
    return Response(
        {"status": "error", "message": "Internal server error"},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _extract_message(data) -> str:
    if isinstance(data, dict):
        for key, value in data.items():
            if key == "detail":
                return str(value)
            if isinstance(value, list) and value:
                return f"{key}: {value[0]}"
        return str(data)
    if isinstance(data, list) and data:
        return str(data[0])
    return str(data)
