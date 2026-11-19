"""
Serializers do two jobs:
  1. OUTPUT: turn a database object into JSON the front-end can read.
  2. INPUT:  check JSON sent by the front-end (required fields, uniqueness,
             ranges) BEFORE anything touches the database.
Validation errors come back as {"field": ["message"]} with HTTP 400, which the
front-end (errors.js) turns into a readable sentence.
"""
from rest_framework import serializers

from .models import Attendance, Course, Grade, Student


class UserProfileSerializer(serializers.Serializer):
    role = serializers.CharField()


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
