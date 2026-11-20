// views/dashboard.js - school overview, performance charts, and recent students.
// Every view exports ONE function, render(ctx), that app.js calls when the URL
// hash matches. ctx gives it: el (the page area), stale() (has the user already
// navigated elsewhere?), and mount(html) (draw HTML into the page area).

import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, skeleton, badge, avatar, fmtDate } from "../ui.js";
import { barList, donut, GRADE_COLORS } from "../charts.js";
import { LETTERS } from "../grading.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(4);
  const d = await api.dashboard();
  if (stale()) return; // the user clicked another menu item while we were loading

  const role = api.role();
  const name = api.auth.username();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const date = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const quickLinks = {
    principal: [
      { label: "View students", href: "#/students", icon: "users" },
      { label: "Leadership reports", href: "#/reports", icon: "dashboard" },
    ],
    registrar: [
      { label: "Admissions", href: "#/admissions", icon: "users" },
      { label: "Student records", href: "#/students", icon: "users" },
    ],
    student: [
      { label: "My records", href: "#/my-records", icon: "users" },
      { label: "Explore courses", href: "#/courses", icon: "book" },
    ],
  }[role] || [];

  const percent = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
  };
  const activeRate = d.total_students ? (d.active_students / d.total_students) * 100 : 0;

  const pulse = (label, value, description, color) => `
    <div class="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
      <div class="mb-3 flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-indigo-100">${esc(label)}</span>
        <span class="text-lg font-bold tabular-nums text-white">${esc(value)}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${percent(String(value).replace("%", ""))}" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700" style="width:${percent(String(value).replace("%", ""))}%"></div>
      </div>
      <p class="mt-2 text-xs text-indigo-200">${esc(description)}</p>
    </div>`;

  const stat = (label, value, hint, iconName, tone, accent) => `
    <div class="${ui.card} group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}"></div>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">${esc(label)}</p>
          <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">${esc(value)}</p>
          <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">${esc(hint)}</p>
        </div>
        <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone} transition duration-200 group-hover:scale-105">${icon(iconName, 21)}</span>
      </div>
    </div>`;

  const gradeItems = LETTERS.map((letter) => ({
    label: `Grade ${letter}`,
    value: d.grade_distribution[letter] ?? 0,
    color: GRADE_COLORS[letter],
  }));

  const statusTile = (key, label, tone, dot) => {
    const count = d.status_breakdown[key] ?? 0;
    const share = d.total_students ? Math.round((count / d.total_students) * 100) : 0;
    return `<div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
      <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full ${dot}"></span><span class="text-sm font-medium text-slate-600 dark:text-slate-300">${label}</span></div>
      <p class="mt-3 text-2xl font-bold tabular-nums ${tone}">${count}</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${share}% of enrollment</p>
    </div>`;
  };

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
    <section class="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-xl sm:p-8">
      <div class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl"></div>
      <div class="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
        <div>
          <p class="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> SCHOOL OVERVIEW
          </p>
          <p class="text-sm font-medium text-indigo-200">${esc(date)}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">${esc(greeting)}, ${esc(name)}</h1>
          <p class="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">Here's a clear view of enrollment, attendance, and academic progress across your school.</p>
          ${quickLinks.length ? `<div class="mt-6 flex flex-wrap gap-3">${quickLinks.map((link, index) => `
            <a href="${link.href}" class="inline-flex items-center gap-2 rounded-xl ${index === 0 ? "bg-white text-indigo-950 hover:bg-indigo-50" : "border border-white/20 bg-white/10 text-white hover:bg-white/15"} px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              ${icon(link.icon, 17)}${esc(link.label)}
            </a>`).join("")}</div>` : ""}
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          ${pulse("Attendance", `${d.attendance_rate}%`, "Present + late sessions", "from-emerald-300 to-teal-400")}
          ${pulse("Active enrollment", `${Math.round(activeRate)}%`, `${d.active_students} of ${d.total_students} students active`, "from-sky-300 to-indigo-300")}
        </div>
      </div>
    </section>

    <section class="mt-7" aria-label="School statistics">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key numbers</h2>
        <span class="text-xs text-slate-400 dark:text-slate-500">Updated just now</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        ${stat("Total students", d.total_students, `${d.active_students} currently active`, "users", "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300", "from-indigo-500 to-violet-500")}
        ${stat("Courses", d.total_courses, "offered this term", "book", "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300", "from-sky-400 to-cyan-500")}
        ${stat("Attendance rate", `${d.attendance_rate}%`, "present + late sessions", "calendar", "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300", "from-emerald-400 to-teal-500")}
        ${stat("Average score", `${d.average_score}%`, "across all assessments", "trend", "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300", "from-amber-400 to-orange-500")}
      </div>
    </section>

    <div class="mt-7 grid gap-5 lg:grid-cols-3">
      <section class="${ui.card} p-5 sm:p-6 lg:col-span-2">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">COURSE PULSE</p>
            <h2 class="mt-1 text-base font-semibold">Attendance by course</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Present and late sessions across current courses.</p>
          </div>
          <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">${icon("calendar", 19)}</span>
        </div>
        ${barList(d.attendance_by_course.map((c) => ({ label: c.course, value: c.rate })))}
      </section>
      <section class="${ui.card} p-5 sm:p-6">
        <div class="mb-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">ACADEMIC SNAPSHOT</p>
          <h2 class="mt-1 text-base font-semibold">Grade distribution</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Students by current grade band.</p>
        </div>
        ${donut(gradeItems)}
      </section>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-3">
      <section class="${ui.card} p-5 sm:p-6">
        <div class="mb-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">ENROLLMENT</p>
          <h2 class="mt-1 text-base font-semibold">Student status</h2>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          ${statusTile("active", "Active", "text-emerald-700 dark:text-emerald-300", "bg-emerald-500")}
          ${statusTile("inactive", "Inactive", "text-slate-600 dark:text-slate-300", "bg-slate-400")}
          ${statusTile("graduated", "Graduated", "text-indigo-700 dark:text-indigo-300", "bg-indigo-500")}
        </div>
      </section>
      <section class="${ui.card} p-5 sm:p-6 lg:col-span-2">
        <div class="mb-2 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">LATEST ACTIVITY</p>
            <h2 class="mt-1 text-base font-semibold">Recently added students</h2>
          </div>
          <a href="#/students" class="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10">View all ${icon("right", 15)}</a>
        </div>
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">${recent}</ul>
      </section>
    </div>
  `);
}
