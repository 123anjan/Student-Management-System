import { api } from "../api.js";
import { ui, esc, pageHeader, skeleton, badge, fmtDate } from "../ui.js";
import { letterFor, percent } from "../grading.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(4);
  const students = await api.students.list();
  if (stale()) return;
  const student = students[0];
  if (!student) {
    mount(`${pageHeader("My records", "Your personal academic information.")}<div class="${ui.card} p-6 text-sm text-slate-500">Your student account has not been linked to a student record yet. Ask the registrar to link your account.</div>`);
    return;
  }
  const [courses, grades, attendance] = await Promise.all([
    api.courses.list(),
    api.grades.list({ student: student.id }),
    api.attendance.list({ student: student.id }),
  ]);
  if (stale()) return;
  const gradePercent = grades.length ? grades.reduce((sum, item) => sum + item.score, 0) * 100 / grades.reduce((sum, item) => sum + item.max_score, 0) : 0;
  const attended = attendance.filter((item) => item.status !== "absent").length;
  const attendancePercent = attendance.length ? attended * 100 / attendance.length : 0;
  const myCourses = courses.filter((course) => student.courses.includes(course.id));
  mount(`
    ${pageHeader("My records", "Your personal academic information and current progress.")}
    <section class="${ui.card} mb-5 flex flex-wrap items-center justify-between gap-4 p-5"><div><p class="text-sm text-slate-500">Student</p><h2 class="mt-1 text-xl font-bold">${esc(student.first_name)} ${esc(student.last_name)}</h2><p class="mt-1 text-sm text-slate-500">${esc(student.roll_no)} · ${esc(student.email)}</p></div>${badge(student.status)}</section>
    <div class="mb-5 grid gap-4 sm:grid-cols-3">${[
      ["Enrolled courses", myCourses.length],
      ["Grade average", `${gradePercent.toFixed(1)}% ${grades.length ? `(${letterFor(gradePercent)})` : ""}`],
      ["Attendance", `${attendancePercent.toFixed(1)}%`],
    ].map(([label, value]) => `<article class="${ui.card} p-5"><p class="text-sm text-slate-500">${label}</p><p class="mt-2 text-2xl font-bold">${value}</p></article>`).join("")}</div>
    <div class="grid gap-5 xl:grid-cols-2">
      <section class="${ui.card} overflow-hidden"><div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">My courses</h2></div><ul class="divide-y divide-slate-100 dark:divide-slate-800">${myCourses.map((course) => `<li class="flex items-center justify-between p-4"><div><p class="font-medium">${esc(course.name)}</p><p class="font-mono text-xs text-slate-500">${esc(course.code)}</p></div><span class="text-sm text-slate-500">${course.credits} credits</span></li>`).join("") || `<li class="p-4 text-sm text-slate-500">No courses enrolled.</li>`}</ul></section>
      <section class="${ui.card} overflow-hidden"><div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">Recent assessments</h2></div><ul class="divide-y divide-slate-100 dark:divide-slate-800">${grades.slice(0, 8).map((grade) => `<li class="flex items-center justify-between gap-3 p-4"><div><p class="font-medium">${esc(grade.title)}</p><p class="text-xs text-slate-500">${fmtDate(grade.date)}</p></div><div class="text-right"><p class="font-semibold">${grade.score} / ${grade.max_score}</p>${badge(letterFor(percent(grade.score, grade.max_score)))}</div></li>`).join("") || `<li class="p-4 text-sm text-slate-500">No assessment results yet.</li>`}</ul></section>
    </div>`);
}
