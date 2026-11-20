// =============================================================================
// demo-store.js - a tiny "fake backend" that lives inside the browser.
// =============================================================================
// GitHub Pages cannot run Python/Django, so in demo mode this file plays the
// role of the server: it keeps tables (students, courses, attendance, grades)
// in localStorage and exposes the same functions the real REST API offers.
//
// Rules it follows so the UI cannot tell the difference from Django:
//   * returns the same JSON shapes the Django serializers return
//   * validates the same way (required fields, unique roll number/email...)
//   * throws ApiError with the same style of message
//   * deleting a student/course also deletes the related records (cascade)

import { ApiError, fieldError } from "./errors.js";
import { letterFor, percent, LETTERS } from "./grading.js";
import { noticeFileStore, portalStore } from "./portal-store.js";

const DB_KEY = "edutrack_demo_db_v1";
const NOTICE_PDF_URLS = new Map();
let db = null;

const delay = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms)); // feels like a network call
const clone = (value) => structuredClone(value); // never hand out the live objects

async function noticePdfUrl(notice) {
  if (!notice.pdf_key) return null;
  if (!NOTICE_PDF_URLS.has(notice.pdf_key)) {
    const file = await noticeFileStore.get(notice.pdf_key);
    if (!file) throw new ApiError("The attached notice PDF could not be found in this browser.", 404);
    NOTICE_PDF_URLS.set(notice.pdf_key, URL.createObjectURL(file));
  }
  return NOTICE_PDF_URLS.get(notice.pdf_key);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      db = JSON.parse(raw);
      return db;
    }
  } catch {
    /* corrupted or blocked storage - fall through and re-seed */
  }
  db = seed();
  save();
  return db;
}

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage full / private mode: keep working in memory only */
  }
}

const nextId = (table) => (db.seq[table] = (db.seq[table] || 0) + 1);

function requireDemoRole(allowed) {
  let role = "principal";
  try { role = localStorage.getItem("edutrack_role") || role; } catch {}
  if (!allowed.includes(role)) throw new ApiError("Your role does not have permission for this action.", 403);
}

export function resetDemoData() {
  db = seed();
  save();
}

// ---------------------------------------------------------------------------
// Seed data - deterministic pseudo-random numbers so every visitor starts
// with the same realistic data set.
// ---------------------------------------------------------------------------
function mulberry32(seedValue) {
  let a = seedValue;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function seed() {
  const rand = mulberry32(2026);
  const courses = [
    { code: "CS101", name: "Introduction to Programming", instructor: "Dr. Meera Iyer", credits: 4 },
    { code: "CS204", name: "Data Structures", instructor: "Prof. Arjun Rao", credits: 4 },
    { code: "MA110", name: "Discrete Mathematics", instructor: "Dr. Sana Khan", credits: 3 },
    { code: "EN105", name: "Technical Communication", instructor: "Ms. Lila Dutta", credits: 2 },
    { code: "DB301", name: "Database Systems", instructor: "Dr. Rohit Sen", credits: 4 },
  ].map((c, i) => ({ id: i + 1, ...c }));

  const firstNames = ["Aarav", "Diya", "Rohan", "Ananya", "Kabir", "Isha", "Vihaan", "Meera", "Arjun", "Sneha", "Aditya", "Riya", "Karan", "Priya", "Neel", "Tara", "Dev", "Pooja", "Rahul", "Nisha", "Siddharth", "Kavya", "Ishaan", "Sara"];
  const lastNames = ["Sharma", "Das", "Mehta", "Banerjee", "Singh", "Roy", "Gupta", "Nair", "Patel", "Ghosh", "Khan", "Reddy"];
  const cities = ["Kolkata", "Pune", "Bengaluru", "Hyderabad", "Jaipur", "Chennai"];
  const intakes = ["2024-07-15", "2025-07-14", "2026-07-13"];
  const genders = ["male", "female", "other"];

  const students = firstNames.map((first, i) => {
    const last = lastNames[(i * 5 + 3) % lastNames.length];
    const courseIds = courses
      .map((c) => c.id)
      .sort(() => rand() - 0.5)
      .slice(0, 3)
      .sort((a, b) => a - b);
    let status = "active";
    if (i % 7 === 6) status = "inactive";
    if (i % 9 === 8) status = "graduated";
    return {
      id: i + 1,
      roll_no: `STU-2026-${pad(i + 1, 3)}`,
      first_name: first,
      last_name: last,
      email: `${first}.${last}${i + 1}@example.edu`.toLowerCase(),
      phone: `+91 9${pad(Math.floor(rand() * 1e9), 9)}`,
      date_of_birth: `${2003 + Math.floor(rand() * 4)}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
      gender: genders[i % 3 === 2 ? 2 : i % 2],
      address: `${cities[i % cities.length]}, India`,
      status,
      enrolled_on: intakes[i % intakes.length],
      courses: courseIds,
      created_at: new Date(Date.now() - (firstNames.length - i) * 3600 * 1000).toISOString(),
    };
  });

  // Attendance: last 10 weekdays, each course meets on alternating days.
  const days = [];
  const cursor = new Date();
  while (days.length < 10) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(isoDay(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  const attendance = [];
  let attendanceId = 0;
  days.forEach((day, dayIndex) => {
    courses.forEach((course) => {
      if ((dayIndex + course.id) % 2 !== 0) return;
      students
        .filter((s) => s.status === "active" && s.courses.includes(course.id))
        .forEach((s) => {
          const roll = rand();
          const status = roll < 0.85 ? "present" : roll < 0.93 ? "late" : "absent";
          attendance.push({ id: ++attendanceId, student: s.id, course: course.id, date: day, status });
        });
    });
  });

  // Grades: three assessments per enrolment; each student has a stable "ability".
  const assessments = [["Quiz 1", 20], ["Midterm", 50], ["Project", 30]];
  const grades = [];
  let gradeId = 0;
  students.forEach((s) => {
    if (s.status === "inactive") return;
    const ability = 0.58 + rand() * 0.4;
    s.courses.forEach((courseId) => {
      assessments.forEach(([title, max], k) => {
        const ratio = Math.min(1, Math.max(0.2, ability + (rand() - 0.5) * 0.14));
        const when = new Date();
        when.setDate(when.getDate() - (60 - k * 20));
        grades.push({
          id: ++gradeId,
          student: s.id,
          course: courseId,
          title,
          score: Math.round(max * ratio * 10) / 10,
          max_score: max,
          date: isoDay(when),
        });
      });
    });
  });

  return {
    students,
    courses,
    attendance,
    grades,
    seq: { students: students.length, courses: courses.length, attendance: attendanceId, grades: gradeId },
  };
}

// ---------------------------------------------------------------------------
// Validation helpers (mirror the Django serializers)
// ---------------------------------------------------------------------------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ["active", "inactive", "graduated"];

function requireText(data, key) {
  if (!String(data[key] ?? "").trim()) throw fieldError(key, "This field is required.");
}

function cleanStudent(data, ignoreId = null) {
  ["roll_no", "first_name", "last_name", "email"].forEach((k) => requireText(data, k));
  const roll = data.roll_no.trim();
  const email = data.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw fieldError("email", "Enter a valid email address.");
  if (db.students.some((s) => s.id !== ignoreId && s.roll_no.toLowerCase() === roll.toLowerCase())) {
    throw fieldError("roll_no", "student with this roll no already exists.");
  }
  if (db.students.some((s) => s.id !== ignoreId && s.email.toLowerCase() === email)) {
    throw fieldError("email", "student with this email already exists.");
  }
  if (data.status && !STATUSES.includes(data.status)) throw fieldError("status", "Not a valid choice.");
  const courseIds = [].concat(data.courses ?? []).map(Number);
  if (courseIds.some((id) => !db.courses.some((c) => c.id === id))) {
    throw fieldError("courses", "One of the selected courses does not exist.");
  }
  return {
    roll_no: roll,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email,
    phone: (data.phone ?? "").trim(),
    date_of_birth: data.date_of_birth || null,
    gender: data.gender || "",
    address: (data.address ?? "").trim(),
    status: data.status || "active",
    enrolled_on: data.enrolled_on || isoDay(new Date()),
    courses: [...new Set(courseIds)],
  };
}

function cleanCourse(data, ignoreId = null) {
  ["code", "name"].forEach((k) => requireText(data, k));
  const code = data.code.trim().toUpperCase();
  if (db.courses.some((c) => c.id !== ignoreId && c.code === code)) {
    throw fieldError("code", "course with this code already exists.");
  }
  const credits = Number(data.credits ?? 3);
  if (!Number.isInteger(credits) || credits < 1 || credits > 10) {
    throw fieldError("credits", "Enter a whole number between 1 and 10.");
  }
  return { code, name: data.name.trim(), instructor: (data.instructor ?? "").trim(), credits };
}

function cleanGrade(data) {
  requireText(data, "title");
  const student = Number(data.student);
  const course = Number(data.course);
  if (!db.students.some((s) => s.id === student)) throw fieldError("student", "Select a valid student.");
  if (!db.courses.some((c) => c.id === course)) throw fieldError("course", "Select a valid course.");
  const score = Number(data.score);
  const max = Number(data.max_score ?? 100);
  if (!Number.isFinite(score) || score < 0) throw fieldError("score", "Enter a score of 0 or more.");
  if (!Number.isFinite(max) || max <= 0) throw fieldError("max_score", "Maximum score must be above 0.");
  if (score > max) throw fieldError("score", "Score cannot be higher than the maximum score.");
  return { student, course, title: data.title.trim(), score, max_score: max, date: data.date || isoDay(new Date()) };
}

const notFound = () => new ApiError("Not found.", 404);

// ---------------------------------------------------------------------------
// The public API - same names/shape as the live REST client in api.js
// ---------------------------------------------------------------------------
export const demoApi = {
  auth: {
    async login(username, password) {
      await delay(250);
      const accounts = {
        admin: ["admin123", "principal"],
        principal: ["principal123", "principal"],
        teacher: ["teacher123", "teacher"],
        student: ["student123", "student"],
        registrar: ["registrar123", "registrar"],
        accountant: ["accountant123", "accountant"],
        librarian: ["librarian123", "librarian"],
      };
      if (accounts[username]?.[0] === password) {
        return { username, token: `demo-${accounts[username][1]}-token`, role: accounts[username][1] };
      }
      throw new ApiError("Wrong username or password.", 400);
    },
  },

  async dashboard() {
    requireDemoRole(["principal", "registrar", "teacher", "student", "accountant", "librarian"]);
    await delay();
    load();
    const attended = db.attendance.filter((a) => a.status !== "absent").length;
    const rate = db.attendance.length ? Math.round((attended * 1000) / db.attendance.length) / 10 : 0;

    const byCourse = db.courses.map((course) => {
      const rows = db.attendance.filter((a) => a.course === course.id);
      const ok = rows.filter((a) => a.status !== "absent").length;
      return { course: course.code, rate: rows.length ? Math.round((ok * 1000) / rows.length) / 10 : 0 };
    });

    const totals = {};
    db.grades.forEach((g) => {
      totals[g.student] ??= { score: 0, max: 0 };
      totals[g.student].score += g.score;
      totals[g.student].max += g.max_score;
    });
    const distribution = Object.fromEntries(LETTERS.map((l) => [l, 0]));
    Object.values(totals).forEach((t) => (distribution[letterFor(percent(t.score, t.max))] += 1));
    const allScore = db.grades.reduce((s, g) => s + g.score, 0);
    const allMax = db.grades.reduce((s, g) => s + g.max_score, 0);

    const count = (status) => db.students.filter((s) => s.status === status).length;
    return clone({
      total_students: db.students.length,
      active_students: count("active"),
      total_courses: db.courses.length,
      attendance_rate: rate,
      average_score: allMax ? Math.round((allScore * 1000) / allMax) / 10 : 0,
      status_breakdown: { active: count("active"), inactive: count("inactive"), graduated: count("graduated") },
      attendance_by_course: byCourse,
      grade_distribution: distribution,
      recent_students: [...db.students].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    });
  },

  students: {
    async list() {
      requireDemoRole(["principal", "registrar", "teacher", "student", "accountant", "librarian"]);
      await delay();
      const role = localStorage.getItem("edutrack_role") || "principal";
      const rows = load().students;
      return clone(role === "student" ? rows.slice(0, 1) : rows);
    },
    async create(data) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const row = { id: nextId("students"), ...cleanStudent(data), created_at: new Date().toISOString() };
      db.students.push(row);
      save();
      return clone(row);
    },
    async update(id, data) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const row = db.students.find((s) => s.id === Number(id));
      if (!row) throw notFound();
      Object.assign(row, cleanStudent(data, row.id));
      save();
      return clone(row);
    },
    async remove(id) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const sid = Number(id);
      if (!db.students.some((s) => s.id === sid)) throw notFound();
      db.students = db.students.filter((s) => s.id !== sid);
      db.attendance = db.attendance.filter((a) => a.student !== sid);
      db.grades = db.grades.filter((g) => g.student !== sid);
      save();
      return null;
    },
  },

  courses: {
    async list() {
      await delay();
      load();
      return clone(db.courses.map((c) => ({ ...c, student_count: db.students.filter((s) => s.courses.includes(c.id)).length })));
    },
    async create(data) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const row = { id: nextId("courses"), ...cleanCourse(data) };
      db.courses.push(row);
      save();
      return clone({ ...row, student_count: 0 });
    },
    async update(id, data) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const row = db.courses.find((c) => c.id === Number(id));
      if (!row) throw notFound();
      Object.assign(row, cleanCourse(data, row.id));
      save();
      return clone(row);
    },
    async remove(id) {
      requireDemoRole(["principal", "registrar"]);
      await delay();
      load();
      const cid = Number(id);
      if (!db.courses.some((c) => c.id === cid)) throw notFound();
      db.courses = db.courses.filter((c) => c.id !== cid);
      db.students.forEach((s) => (s.courses = s.courses.filter((x) => x !== cid)));
      db.attendance = db.attendance.filter((a) => a.course !== cid);
      db.grades = db.grades.filter((g) => g.course !== cid);
      save();
      return null;
    },
  },

  attendance: {
    async list({ course, date, student } = {}) {
      await delay(60);
      load();
      return clone(
        db.attendance.filter(
          (a) =>
            (!course || a.course === Number(course)) &&
            (!date || a.date === date) &&
            (!student || a.student === Number(student))
        )
      );
    },
    // One call saves a whole class for one day. Existing rows are updated
    // (upsert), so pressing Save twice never creates duplicates.
    async save({ course, date, records }) {
      requireDemoRole(["principal", "teacher"]);
      await delay();
      load();
      if (!db.courses.some((c) => c.id === Number(course))) throw fieldError("course", "Select a valid course.");
      if (!date) throw fieldError("date", "This field is required.");
      const saved = records.map((r) => {
        if (!["present", "late", "absent"].includes(r.status)) throw fieldError("status", "Not a valid choice.");
        let row = db.attendance.find((a) => a.student === Number(r.student) && a.course === Number(course) && a.date === date);
        if (row) row.status = r.status;
        else {
          row = { id: nextId("attendance"), student: Number(r.student), course: Number(course), date, status: r.status };
          db.attendance.push(row);
        }
        return row;
      });
      save();
      return clone(saved);
    },
  },

  grades: {
    async list({ course, student } = {}) {
      await delay();
      load();
      const role = localStorage.getItem("edutrack_role") || "principal";
      return clone(db.grades.filter((g) => (!course || g.course === Number(course)) && (!student || g.student === Number(student)) && (role !== "student" || g.student === db.students[0]?.id)));
    },
    async create(data) {
      requireDemoRole(["principal", "teacher"]);
      await delay();
      load();
      const row = { id: nextId("grades"), ...cleanGrade(data) };
      db.grades.push(row);
      save();
      return clone(row);
    },
    async update(id, data) {
      requireDemoRole(["principal", "teacher"]);
      await delay();
      load();
      const row = db.grades.find((g) => g.id === Number(id));
      if (!row) throw notFound();
      Object.assign(row, cleanGrade(data));
      save();
      return clone(row);
    },
    async remove(id) {
      requireDemoRole(["principal", "teacher"]);
      await delay();
      load();
      if (!db.grades.some((g) => g.id === Number(id))) throw notFound();
      db.grades = db.grades.filter((g) => g.id !== Number(id));
      save();
      return null;
    },
  },

  notices: {
    async list() {
      requireDemoRole(["principal", "registrar", "teacher", "student", "accountant", "librarian"]);
      await delay();
      const notices = await Promise.all(portalStore.list("notices").map(async (notice) => ({
        ...notice,
        pdf_url: await noticePdfUrl(notice),
      })));
      return clone(notices);
    },
    async create(data) {
      requireDemoRole(["principal", "registrar", "teacher"]);
      await delay();
      const file = data.get("pdf");
      if (file?.size) {
        const role = localStorage.getItem("edutrack_role") || "principal";
        if (role !== "principal") throw new ApiError("Only the Principal can attach a PDF.", 403);
        if (file.size > 10 * 1024 * 1024) throw new ApiError("PDF files must be 10 MB or smaller.", 400);
        if (!file.name.toLowerCase().endsWith(".pdf") || await file.slice(0, 5).text() !== "%PDF-") {
          throw new ApiError("Choose a valid PDF file.", 400);
        }
      }
      const pdfKey = file?.size ? `notice-${Date.now()}-${Math.random().toString(36).slice(2)}` : null;
      const pdfUrl = file?.size ? URL.createObjectURL(file) : null;
      try {
        if (pdfKey) await noticeFileStore.save(pdfKey, file);
        const notice = portalStore.add("notices", {
          title: data.get("title").trim(),
          category: data.get("category").trim(),
          body: data.get("body").trim(),
          date: isoDay(new Date()),
          author: localStorage.getItem("edutrack_user") || "admin",
          ...(pdfKey ? { pdf_key: pdfKey } : {}),
        });
        if (pdfKey) NOTICE_PDF_URLS.set(pdfKey, pdfUrl);
        return clone({ ...notice, pdf_url: pdfUrl });
      } catch (error) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        if (pdfKey) await noticeFileStore.remove(pdfKey);
        throw error;
      }
    },
  },
};
