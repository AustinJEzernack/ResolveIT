"""
Workshop: top-level tenant container.
Workbench: a named partition inside a Workshop used to isolate tickets.
"""
import uuid

from django.db import models


class Workshop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    logo_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workshops"

    def __str__(self):
        return self.name


class Workbench(models.Model):
    """Named partition inside a Workshop. Tickets are always scoped to a Workbench."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, blank=True)  # hex e.g. #3B82F6
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    workshop = models.ForeignKey(
        Workshop, on_delete=models.CASCADE, related_name="workbenches"
    )

    class Meta:
        db_table = "workbenches"
        unique_together = [["workshop", "name"]]
        ordering = ["name"]

    def __str__(self):
        return f"{self.workshop.name} / {self.name}"
