"""Top-level URL table: /admin/ is Django's built-in admin, /api/ is our REST API."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("students.urls")),
]
