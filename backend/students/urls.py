from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceViewSet,
    CourseViewSet,
    DashboardView,
    GradeViewSet,
    LoginView,
    NoticeViewSet,
    StudentViewSet,
)

# The router writes the list/detail URLs for each ViewSet automatically.
router = DefaultRouter()
router.register("students", StudentViewSet, basename="student")
router.register("courses", CourseViewSet, basename="course")
router.register("grades", GradeViewSet, basename="grade")
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("notices", NoticeViewSet, basename="notice")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
