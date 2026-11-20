"""
Serializers do two jobs:
  1. OUTPUT: turn a database object into JSON the front-end can read.
  2. INPUT:  check JSON sent by the front-end (required fields, uniqueness,
             ranges) BEFORE anything touches the database.
Validation errors come back as {"field": ["message"]} with HTTP 400, which the
front-end (errors.js) turns into a readable sentence.
"""
from django.urls import reverse

from rest_framework import serializers

from .models import Attendance, Course, Grade, Notice, Student


class UserProfileSerializer(serializers.Serializer):
    role = serializers.CharField()


class NoticeSerializer(serializers.ModelSerializer):
    pdf = serializers.FileField(write_only=True, required=False)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = ["id", "title", "category", "body", "date", "author", "pdf", "pdf_url"]
        read_only_fields = ["id", "author", "pdf_url"]

    def get_pdf_url(self, obj):
        if not obj.pdf:
            return None
        path = reverse("notice-pdf", kwargs={"pk": obj.pk})
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path

    def validate_pdf(self, value):
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("PDF files must be 10 MB or smaller.")
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Upload a PDF file.")
        if value.read(5) != b"%PDF-":
            raise serializers.ValidationError("The uploaded file is not a valid PDF.")
        value.seek(0)
        request = self.context.get("request")
        profile = getattr(request.user, "role_profile", None) if request else None
        if request and not request.user.is_superuser and getattr(profile, "role", None) != "principal":
            raise serializers.ValidationError("Only the Principal can attach a PDF.")
        return value


class CourseSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "code", "name", "instructor", "credits", "student_count"]

    def get_student_count(self, obj):
        # The list view annotates this number in one query (see views.py);
        # fall back to counting for single objects.
        annotated = getattr(obj, "student_count", None)
        return annotated if annotated is not None else obj.students.count()

    def validate_code(self, value):
        value = value.strip().upper()
        clash = Course.objects.filter(code__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("course with this code already exists.")
        return value


class StudentSerializer(serializers.ModelSerializer):
    # Courses travel as a list of ids: [1, 3]
    courses = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Course.objects.all(), required=False
    )

    class Meta:
        model = Student
        fields = [
            "id", "roll_no", "first_name", "last_name", "email", "phone",
            "date_of_birth", "gender", "address", "status", "enrolled_on",
            "courses", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def _unique(self, field, value, message):
        clash = Student.objects.filter(**{f"{field}__iexact": value})
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(message)

    def validate_roll_no(self, value):
        value = value.strip()
        self._unique("roll_no", value, "student with this roll no already exists.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        self._unique("email", value, "student with this email already exists.")
        return value


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ["id", "student", "course", "title", "score", "max_score", "date"]

    def validate(self, data):
        score = data.get("score", getattr(self.instance, "score", None))
        maximum = data.get("max_score", getattr(self.instance, "max_score", None))
        if score is not None and maximum is not None and score > maximum:
            raise serializers.ValidationError(
                {"score": "Score cannot be higher than the maximum score."}
            )
        return data


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ["id", "student", "course", "date", "status"]


# --- bulk attendance: one request saves a whole class for one day ------------
class AttendanceRecordSerializer(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    status = serializers.ChoiceField(choices=Attendance.Status.choices)


class AttendanceBulkSerializer(serializers.Serializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    date = serializers.DateField()
    records = AttendanceRecordSerializer(many=True, allow_empty=False)
