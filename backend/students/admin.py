"""Registers the models in Django's built-in admin site at /admin/ (free data editor)."""
from django.contrib import admin

from .models import Attendance, Course, Grade, Student


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "instructor", "credits")
    search_fields = ("code", "name", "instructor")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("roll_no", "first_name", "last_name", "email", "status", "enrolled_on")
    list_filter = ("status", "gender", "courses")
    search_fields = ("roll_no", "first_name", "last_name", "email")
    filter_horizontal = ("courses",)


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("date", "course", "student", "status")
    list_filter = ("status", "course", "date")


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "title", "score", "max_score", "date")
    list_filter = ("course",)
