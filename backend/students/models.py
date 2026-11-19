"""
Database design (each class below becomes one table):

    Course 1 ---< Attendance >--- 1 Student
    Course 1 ---< Grade      >--- 1 Student
    Student >---< Course   (many-to-many: a student takes many courses,
                            a course has many students)

"1 ---<" means one-to-many: ONE student has MANY attendance rows.
"""
from datetime import date

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    instructor = models.CharField(max_length=120, blank=True)
    credits = models.PositiveSmallIntegerField(
        default=3, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Student(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        GRADUATED = "graduated", "Graduated"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    roll_no = models.CharField(max_length=30, unique=True)
    first_name = models.CharField(max_length=60)
    last_name = models.CharField(max_length=60)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=25, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    enrolled_on = models.DateField(default=date.today)
    courses = models.ManyToManyField(Course, related_name="students", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.roll_no})"


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        LATE = "late", "Late"
        ABSENT = "absent", "Absent"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)

    class Meta:
        ordering = ["-date", "student__first_name"]
        constraints = [
            # One row per student, per course, per day. The DATABASE enforces
            # this, so duplicates are impossible even if the code has a bug.
            models.UniqueConstraint(fields=["student", "course", "date"], name="one_attendance_per_day")
        ]

    def __str__(self):
        return f"{self.student} {self.course.code} {self.date} {self.status}"


class Grade(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="grades")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="grades")
    title = models.CharField(max_length=80)  # e.g. "Midterm"
    score = models.FloatField(validators=[MinValueValidator(0)])
    max_score = models.FloatField(default=100, validators=[MinValueValidator(0.01)])
    date = models.DateField(default=date.today)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.student} {self.title}: {self.score}/{self.max_score}"
