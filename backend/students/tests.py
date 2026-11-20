"""
Automated tests. Run with:  python manage.py test
Each test starts from an EMPTY temporary database, so tests never touch real data.
"""
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Attendance, Course, Grade, Notice, Student
from .views import LoginView


class ApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser("admin", email="admin@example.com", password="s3cret-pass")
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

    def test_superuser_login_returns_principal_role(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "s3cret-pass"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "principal")

    def test_accountant_can_read_but_not_change_student_records(self):
        user = get_user_model().objects.create_user("accounts", password="s3cret-pass")
        user.role_profile.role = "accountant"
        user.role_profile.save()
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get("/api/students/").status_code, 200)
        self.assertEqual(self.client.post("/api/students/", self.student_payload(), format="json").status_code, 403)

    def test_student_only_sees_linked_student_records(self):
        own = Student.objects.create(roll_no="S-OWN", first_name="Own", last_name="Student", email="own@example.edu")
        other = Student.objects.create(roll_no="S-OTHER", first_name="Other", last_name="Student", email="other@example.edu")
        user = get_user_model().objects.create_user("learner", password="s3cret-pass")
        user.role_profile.role = "student"
        user.role_profile.student = own
        user.role_profile.save()
        self.client.force_authenticate(user=user)
        self.assertEqual([row["id"] for row in self.client.get("/api/students/").data], [own.id])
        Grade.objects.create(student=own, course=self.course, title="Quiz", score=8, max_score=10)
        Grade.objects.create(student=other, course=self.course, title="Quiz", score=4, max_score=10)
        self.assertEqual([row["student"] for row in self.client.get("/api/grades/").data], [own.id])

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


class NoticeApiTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        media_settings = override_settings(MEDIA_ROOT=self.media_dir.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)
        self.principal = get_user_model().objects.create_user(
            "head", email="head@example.edu", password="s3cret-pass"
        )
        self.principal.role_profile.role = "principal"
        self.principal.role_profile.save()
        self.client.force_authenticate(user=self.principal)

    def pdf_file(self, name="notice.pdf", content=b"%PDF-1.4\nnotice\n%%EOF"):
        return SimpleUploadedFile(name, content, content_type="application/pdf")

    def test_principal_can_upload_pdf_and_anyone_can_open_it_inline(self):
        response = self.client.post(
            "/api/notices/",
            {
                "title": "Exam schedule",
                "category": "Academics",
                "body": "See the attached schedule.",
                "pdf": self.pdf_file(),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["pdf_url"].endswith(f"/api/notices/{response.data['id']}/pdf/"))

        self.client.force_authenticate(user=None)
        download = self.client.get(reverse("notice-pdf", kwargs={"pk": response.data["id"]}))
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download["Content-Type"], "application/pdf")
        self.assertTrue(download["Content-Disposition"].startswith("inline;"))
        self.assertTrue(b"".join(download.streaming_content).startswith(b"%PDF-1.4"))

    def test_teacher_can_post_text_but_cannot_attach_pdf(self):
        teacher = get_user_model().objects.create_user("teacher", password="s3cret-pass")
        teacher.role_profile.role = "teacher"
        teacher.role_profile.save()
        self.client.force_authenticate(user=teacher)
        payload = {"title": "Meeting", "category": "Staff", "body": "Staff meeting Friday."}
        response = self.client.post("/api/notices/", payload, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["pdf_url"])

        payload["pdf"] = self.pdf_file()
        response = self.client.post("/api/notices/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("pdf", response.data)
        self.assertEqual(Notice.objects.count(), 1)

    def test_student_can_read_notices_but_cannot_post(self):
        student = get_user_model().objects.create_user("learner", password="s3cret-pass")
        student.role_profile.role = "student"
        student.role_profile.save()
        self.client.force_authenticate(user=student)
        self.assertEqual(self.client.get("/api/notices/").status_code, 200)
        response = self.client.post(
            "/api/notices/",
            {"title": "No", "category": "Test", "body": "Not allowed."},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)

    def test_upload_rejects_non_pdf_and_invalid_pdf_signature(self):
        payload = {"title": "Invalid", "category": "Test", "body": "Invalid upload."}
        payload["pdf"] = self.pdf_file("notice.txt", b"not a PDF")
        response = self.client.post("/api/notices/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("pdf", response.data)

        payload["pdf"] = self.pdf_file(content=b"not a PDF")
        response = self.client.post("/api/notices/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("pdf", response.data)
