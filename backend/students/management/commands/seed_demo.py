"""
Usage:  python manage.py seed_demo --password "a-strong-password"

Creates an admin login plus realistic sample data so the dashboard is not empty.
Safe to run twice: it never duplicates the admin user and refuses to add sample
data if students already exist (unless you pass --force).
"""
import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from students.models import Attendance, Course, Grade, Student

FIRST = ["Aarav", "Diya", "Rohan", "Ananya", "Kabir", "Isha", "Vihaan", "Meera", "Arjun", "Sneha", "Aditya", "Riya"]
LAST = ["Sharma", "Das", "Mehta", "Banerjee", "Singh", "Roy", "Gupta", "Nair", "Patel", "Ghosh"]
COURSES = [
    ("CS101", "Introduction to Programming", "Dr. Meera Iyer", 4),
    ("CS204", "Data Structures", "Prof. Arjun Rao", 4),
    ("MA110", "Discrete Mathematics", "Dr. Sana Khan", 3),
    ("EN105", "Technical Communication", "Ms. Lila Dutta", 2),
    ("DB301", "Database Systems", "Dr. Rohit Sen", 4),
]


class Command(BaseCommand):
    help = "Create an admin user and sample students, courses, attendance and grades."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--password", required=True, help="Password for the admin user")
        parser.add_argument("--force", action="store_true", help="Add sample data even if students exist")

    def handle(self, *args, **opts):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=opts["username"], defaults={"is_staff": True, "is_superuser": True}
        )
        user.set_password(opts["password"])  # set_password HASHES it; never store plain text
        user.is_staff = user.is_superuser = True
        user.save()
        self.stdout.write(f"{'Created' if created else 'Updated'} admin user '{user.username}'.")

        if Student.objects.exists() and not opts["force"]:
            raise CommandError("Students already exist; skipped sample data (use --force to add more).")

        rng = random.Random(2026)  # fixed seed -> same data every time
        courses = [Course.objects.get_or_create(code=c, defaults={"name": n, "instructor": i, "credits": k})[0] for c, n, i, k in COURSES]

        students = []
        for i, first in enumerate(FIRST, start=1):
            last = LAST[(i * 3) % len(LAST)]
            student, _ = Student.objects.get_or_create(
                roll_no=f"STU-2026-{i:03d}",
                defaults={
                    "first_name": first, "last_name": last,
                    "email": f"{first}.{last}{i}@example.edu".lower(),
                    "status": "inactive" if i % 7 == 0 else "active",
                },
            )
            student.courses.set(rng.sample(courses, 3))
            students.append(student)

        today = date.today()
        days = [today - timedelta(days=n) for n in range(14) if (today - timedelta(days=n)).weekday() < 5][:10]
        for student in students:
            if student.status != "active":
                continue
            ability = 0.58 + rng.random() * 0.4
            for course in student.courses.all():
                for day in days:
                    roll = rng.random()
                    Attendance.objects.get_or_create(
                        student=student, course=course, date=day,
                        defaults={"status": "present" if roll < 0.85 else "late" if roll < 0.93 else "absent"},
                    )
                for title, maximum in (("Quiz 1", 20), ("Midterm", 50), ("Project", 30)):
                    ratio = min(1, max(0.2, ability + (rng.random() - 0.5) * 0.14))
                    Grade.objects.create(student=student, course=course, title=title,
                                         score=round(maximum * ratio, 1), max_score=maximum)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(students)} students and {len(courses)} courses."))
