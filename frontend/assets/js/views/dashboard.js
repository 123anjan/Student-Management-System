// views/dashboard.js - the overview screen: stat cards + two charts + recent students.
// Every view exports ONE function, render(ctx), that app.js calls when the URL
// hash matches. ctx gives it: el (the page area), stale() (has the user already
// navigated elsewhere?), and mount(html) (draw HTML into the page area).

import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, pageHeader, skeleton, badge, avatar, fmtDate } from "../ui.js";
import { barList, donut, GRADE_COLORS } from "../charts.js";
import { LETTERS } from "../grading.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(4);
  const d = await api.dashboard();
  if (stale()) return; // the user clicked another menu item while we were loading

  const stat = (label, value, hint, iconName, tone) => `
    <div class="${ui.card} flex items-center gap-4 p-5">
      <span class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}">${icon(iconName, 22)}</span>
      <div class="min-w-0">
        <p class="text-sm text-slate-500 dark:text-slate-400">${esc(label)}</p>
        <p class="text-2xl font-bold tabular-nums tracking-tight">${esc(value)}</p>
        <p class="truncate text-xs text-slate-400 dark:text-slate-500">${esc(hint)}</p>
      </div>
    </div>`;

  const gradeItems = LETTERS.map((letter) => ({
    label: `Grade ${letter}`,
    value: d.grade_distribution[letter] ?? 0,
    color: GRADE_COLORS[letter],
  }));

  const statusRow = (key, label) => `
    <li class="flex items-center justify-between py-2.5">
      ${badge(key, label)}
      <span class="text-sm font-semibold tabular-nums">${d.status_breakdown[key] ?? 0}</span>
    </li>`;

  const recent = d.recent_students.length
    ? d.recent_students
        .map(
          (s) => `<li class="flex items-center gap-3 py-3">
            ${avatar(s.first_name, s.last_name)}
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">${esc(s.first_name)} ${esc(s.last_name)}</p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">${esc(s.roll_no)} · joined ${fmtDate(s.enrolled_on)}</p>
            </div>
            ${badge(s.status)}
          </li>`
        )
        .join("")
    : '<li class="py-8 text-center text-sm text-slate-500">No students yet.</li>';

  mount(`
    ${pageHeader("Dashboard", "A live overview of students, attendance and performance.")}

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${stat("Total students", d.total_students, `${d.active_students} currently active`, "users", "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300")}
      ${stat("Courses", d.total_courses, "offered this term", "book", "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300")}
      ${stat("Attendance rate", `${d.attendance_rate}%`, "present + late sessions", "calendar", "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300")}
      ${stat("Average score", `${d.average_score}%`, "across all assessments", "trend", "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300")}
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <section class="${ui.card} p-5 lg:col-span-2">
        <h2 class="mb-4 text-sm font-semibold">Attendance by course</h2>
        ${barList(d.attendance_by_course.map((c) => ({ label: c.course, value: c.rate })))}
      </section>
      <section class="${ui.card} p-5">
        <h2 class="mb-4 text-sm font-semibold">Grade distribution</h2>
        ${donut(gradeItems)}
      </section>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <section class="${ui.card} p-5">
        <h2 class="mb-2 text-sm font-semibold">Student status</h2>
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          ${statusRow("active", "Active")}${statusRow("inactive", "Inactive")}${statusRow("graduated", "Graduated")}
        </ul>
      </section>
      <section class="${ui.card} p-5 lg:col-span-2">
        <div class="mb-1 flex items-center justify-between">
          <h2 class="text-sm font-semibold">Recently added</h2>
          <a href="#/students" class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">View all</a>
        </div>
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">${recent}</ul>
      </section>
    </div>
  `);
}
