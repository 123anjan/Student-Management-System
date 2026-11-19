"""
Views receive an HTTP request and return a response.
A ViewSet bundles list / create / retrieve / update / delete for one model, and
the router in urls.py turns it into the URLs the front-end calls:

    GET    /api/students/       list            POST   /api/students/      create
    GET    /api/students/5/     retrieve        PUT    /api/students/5/    update
                                                DELETE /api/students/5/    delete
"""
from django.db import transaction
from django.db.models import Count, Q, Sum
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.serializers import AuthTokenSerializer
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .grading import LETTERS, letter_for, percent
from .models import Attendance, Course, Grade, Student
from .serializers import (
    AttendanceBulkSerializer,
    AttendanceSerializer,
    CourseSerializer,
    GradeSerializer,
    StudentSerializer,
)


class LoginView(APIView):
    """POST {username, password} -> {username, token}. The only open endpoint."""

    permission_classes = [AllowAny]
    authentication_classes = []  # do not try to authenticate a login request
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"  # limited to 10 attempts/minute (see settings.py)

    def post(self, request):
        serializer = AuthTokenSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)  # wrong password -> HTTP 400
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"username": user.username, "token": token.key})


class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer

    def get_queryset(self):
        # prefetch_related loads every student's courses in ONE extra query
        # instead of one query per student (avoids the "N+1 query" problem).
        qs = Student.objects.prefetch_related("courses")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("course"):
            qs = qs.filter(courses__id=params["course"])
        if params.get("q"):
            q = params["q"]
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q)
                | Q(roll_no__icontains=q) | Q(email__icontains=q)
            )
        return qs


class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.annotate(student_count=Count("students"))


class GradeViewSet(viewsets.ModelViewSet):
    serializer_class = GradeSerializer

    def get_queryset(self):
        qs = Grade.objects.all()
        params = self.request.query_params
        if params.get("course"):
            qs = qs.filter(course_id=params["course"])
        if params.get("student"):
            qs = qs.filter(student_id=params["student"])
        return qs


class AttendanceViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only list plus a custom POST /attendance/bulk/ for saving."""

    serializer_class = AttendanceSerializer

    def get_queryset(self):
        qs = Attendance.objects.all()
        params = self.request.query_params
        for field in ("course", "student"):
            if params.get(field):
                qs = qs.filter(**{f"{field}_id": params[field]})
        if params.get("date"):
            qs = qs.filter(date=params["date"])
        return qs

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        serializer = AttendanceBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # transaction.atomic: either EVERY student is saved or none are.
        with transaction.atomic():
            rows = [
                Attendance.objects.update_or_create(  # update if it exists, else create
                    student=rec["student"], course=data["course"], date=data["date"],
                    defaults={"status": rec["status"]},
                )[0]
                for rec in data["records"]
            ]
        return Response(AttendanceSerializer(rows, many=True).data, status=status.HTTP_200_OK)


class DashboardView(APIView):
    """One endpoint that returns every number the dashboard screen needs."""

    def get(self, request):
        # attendance rate: "present" and "late" both count as attended
        total = Attendance.objects.count()
        attended = Attendance.objects.exclude(status="absent").count()

        by_course = [
            {
                "course": c.code,
                "rate": round(c.ok * 100 / c.total, 1) if c.total else 0,
            }
            for c in Course.objects.annotate(
                total=Count("attendance"),
                ok=Count("attendance", filter=~Q(attendance__status="absent")),
            )
        ]

        # one overall percentage per student, then bucket into letter grades
        distribution = {letter: 0 for letter in LETTERS}
        per_student = Grade.objects.values("student").annotate(s=Sum("score"), m=Sum("max_score"))
        for row in per_student:
            distribution[letter_for(percent(row["s"], row["m"]))] += 1
        all_scores = Grade.objects.aggregate(s=Sum("score"), m=Sum("max_score"))

        counts = {row["status"]: row["n"] for row in Student.objects.values("status").annotate(n=Count("id"))}
        recent = Student.objects.prefetch_related("courses").order_by("-created_at")[:5]

        return Response({
            "total_students": Student.objects.count(),
            "active_students": counts.get("active", 0),
            "total_courses": Course.objects.count(),
            "attendance_rate": round(attended * 100 / total, 1) if total else 0,
            "average_score": round(all_scores["s"] * 100 / all_scores["m"], 1) if all_scores["m"] else 0,
            "status_breakdown": {k: counts.get(k, 0) for k in ("active", "inactive", "graduated")},
            "attendance_by_course": by_course,
            "grade_distribution": distribution,
            "recent_students": StudentSerializer(recent, many=True).data,
        })
