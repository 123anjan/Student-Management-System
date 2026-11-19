"""
Automated tests. Run with:  python manage.py test
Each test starts from an EMPTY temporary database, so tests never touch real data.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Attendance, Course, Grade, Student
from .views import LoginView


class ApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("admin", password="s3cret-pass")
        self.course = Course.objects.create(code="CS101", name="Programming", credits=4)
        self.original_throttle_classes = LoginView.throttle_classes
        LoginView.throttle_classes = []

    def tearDown(self):
        LoginView.throttle_classes = self.original_throttle_classes

    def login(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "s3cret-pass"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

    def student_payload(self, **extra):
        data = {"roll_no": "S-1", "first_name": "Asha", "last_name": "Rao",
                "email": "Asha@Example.com", "courses": [self.course.id]}
        data.update(extra)
        return data

    # --- authentication ---
    def test_api_requires_login(self):
        self.assertEqual(self.client.get("/api/students/").status_code, 401)

    def test_bad_password_is_rejected_with_readable_error(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("non_field_errors", res.data)

    # --- students ---
    def test_create_student_normalises_email_and_links_course(self):
        self.login()
        res = self.client.post("/api/students/", self.student_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["email"], "asha@example.com")
        self.assertEqual(res.data["courses"], [self.course.id])

    def test_duplicate_roll_no_and_email_rejected_case_insensitively(self):
        self.login()
        self.client.post("/api/students/", self.student_payload(), format="json")
        res = self.client.post("/api/students/", self.student_payload(roll_no="s-1", email="x@y.com"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("roll_no", res.data)
        res = self.client.post("/api/students/", self.student_payload(roll_no="S-2", email="ASHA@example.com"), format="json")
        self.assertIn("email", res.data)

    def test_update_own_record_is_not_a_duplicate(self):
        self.login()
        sid = self.client.post("/api/students/", self.student_payload(), format="json").data["id"]
        res = self.client.put(f"/api/students/{sid}/", self.student_payload(first_name="Changed"), format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["first_name"], "Changed")

    def test_deleting_student_cascades(self):
        self.login()
        student = Student.objects.create(roll_no="S-9", first_name="A", last_name="B", email="a@b.com")
        Grade.objects.create(student=student, course=self.course, title="Q", score=5, max_score=10)
        self.assertEqual(self.client.delete(f"/api/students/{student.id}/").status_code, 204)
        self.assertEqual(Grade.objects.count(), 0)

    # --- courses ---
    def test_course_code_uppercased_and_unique(self):
        self.login()
        res = self.client.post("/api/courses/", {"code": "cs101", "name": "Dup", "credits": 3}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.client.post("/api/courses/", {"code": "ma110", "name": "Maths", "credits": 3}, format="json")
        self.assertEqual(res.data["code"], "MA110")

    def test_course_credits_out_of_range(self):
        self.login()
        res = self.client.post("/api/courses/", {"code": "X1", "name": "X", "credits": 99}, format="json")
        self.assertEqual(res.status_code, 400)

    # --- attendance ---
    def test_bulk_attendance_is_an_upsert(self):
        self.login()
        s = Student.objects.create(roll_no="S-2", first_name="C", last_name="D", email="c@d.com")
        body = {"course": self.course.id, "date": "2026-11-13", "records": [{"student": s.id, "status": "present"}]}
        self.assertEqual(self.client.post("/api/attendance/bulk/", body, format="json").status_code, 200)
        body["records"][0]["status"] = "absent"
        self.client.post("/api/attendance/bulk/", body, format="json")
        self.assertEqual(Attendance.objects.count(), 1)  # updated, not duplicated
        self.assertEqual(Attendance.objects.get().status, "absent")

    def test_bulk_attendance_rejects_bad_status(self):
        self.login()
        s = Student.objects.create(roll_no="S-3", first_name="E", last_name="F", email="e@f.com")
        body = {"course": self.course.id, "date": "2026-11-13", "records": [{"student": s.id, "status": "sleeping"}]}
        self.assertEqual(self.client.post("/api/attendance/bulk/", body, format="json").status_code, 400)

    # --- grades ---
    def test_grade_score_cannot_exceed_max(self):
        self.login()
        s = Student.objects.create(roll_no="S-4", first_name="G", last_name="H", email="g@h.com")
        res = self.client.post("/api/grades/", {"student": s.id, "course": self.course.id, "title": "Q", "score": 30, "max_score": 20}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("score", res.data)

    # --- dashboard ---
    def test_dashboard_numbers(self):
        self.login()
        s = Student.objects.create(roll_no="S-5", first_name="I", last_name="J", email="i@j.com")
        Attendance.objects.create(student=s, course=self.course, date="2026-11-12", status="present")
        Attendance.objects.create(student=s, course=self.course, date="2026-11-13", status="absent")
        Grade.objects.create(student=s, course=self.course, title="Final", score=92, max_score=100)
        data = self.client.get("/api/dashboard/").data
        self.assertEqual(data["total_students"], 1)
        self.assertEqual(data["attendance_rate"], 50.0)
        self.assertEqual(data["average_score"], 92.0)
        self.assertEqual(data["grade_distribution"]["A"], 1)
        self.assertEqual(data["attendance_by_course"], [{"course": "CS101", "rate": 50.0}])
