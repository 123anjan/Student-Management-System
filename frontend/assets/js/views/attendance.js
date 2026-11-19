// views/attendance.js - take attendance for one course on one day.
// The teacher picks a course + date, taps Present / Late / Absent for each
// student, then presses Save ONCE. The whole class is sent in a single request.

import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, pageHeader, skeleton, emptyState, avatar, todayISO, toast, selectBox } from "../ui.js";

const OPTIONS = [
  ["present", "Present", "peer-checked:bg-emerald-600 peer-checked:text-white"],
  ["late", "Late", "peer-checked:bg-amber-500 peer-checked:text-white"],
  ["absent", "Absent", "peer-checked:bg-rose-600 peer-checked:text-white"],
];

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(4);
  const canManage = ["principal", "teacher"].includes(api.role());
  const [courses, students] = await Promise.all([api.courses.list(), api.students.list()]);
  if (stale()) return;

  if (!courses.length) {
    mount(`${pageHeader("Attendance", "Mark who attended each class.")}<div class="${ui.card}">${emptyState("No courses yet", "Create a course first, then come back to take attendance.")}</div>`);
    return;
  }

  const sel = { course: courses[0].id, date: todayISO() };
  const page = mount(`
    ${pageHeader("Attendance", "Mark who attended each class.")}
    <div class="${ui.card} overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
        ${selectBox("a-course", "Course", courses.map((c) => [c.id, `${c.code} - ${c.name}`]), sel.course)}
        <input id="a-date" type="date" value="${sel.date}" max="${todayISO()}" class="${ui.input} sm:w-auto" aria-label="Date">
        <div class="flex gap-2 sm:ml-auto">
          <button type="button" data-act="all-present" class="${ui.btnGhost}">${icon("check", 16)} Mark all present</button>
          ${canManage ? `<button type="button" data-act="save" class="${ui.btnPrimary}">Save attendance</button>` : ""}
        </div>
      </div>
      <div id="a-body"></div>
    </div>
  `);

  const body = page.querySelector("#a-body");
  let token = 0; // guards against an older, slower response overwriting a newer one

  async function load() {
    const mine = ++token;
    body.innerHTML = '<div class="p-8 text-center text-sm text-slate-500">Loading...</div>';
    const saved = await api.attendance.list({ course: sel.course, date: sel.date });
    if (mine !== token || stale()) return;
    const byStudent = new Map(saved.map((r) => [r.student, r.status]));

    // Only active students who are enrolled in this course appear.
    const roster = students
      .filter((s) => s.status === "active" && s.courses.includes(Number(sel.course)))
      .sort((a, b) => a.first_name.localeCompare(b.first_name));

    if (!roster.length) {
      body.innerHTML = emptyState("No active students in this course", "Enrol students from the Students page.");
      return;
    }

    body.innerHTML = `
      <p class="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400" id="a-summary"></p>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">${roster
        .map((s) => {
          const current = byStudent.get(s.id) ?? "present";
          return `<li class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-student="${s.id}">
            <div class="flex items-center gap-3">
              ${avatar(s.first_name, s.last_name)}
              <div>
                <p class="text-sm font-medium">${esc(s.first_name)} ${esc(s.last_name)}</p>
                <p class="font-mono text-xs text-slate-500 dark:text-slate-400">${esc(s.roll_no)}</p>
              </div>
            </div>
            <div class="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="radiogroup" aria-label="Attendance for ${esc(s.first_name)}">
              ${OPTIONS.map(
                ([value, label, on]) => `<label class="cursor-pointer">
                  <input type="radio" class="peer sr-only" name="att-${s.id}" value="${value}" ${current === value ? "checked" : ""}>
                  <span class="block rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 dark:text-slate-300 ${on}">${label}</span>
                </label>`
              ).join("")}
            </div>
          </li>`;
        })
        .join("")}</ul>`;
    summarize();
  }

  function collect() {
    return [...body.querySelectorAll("[data-student]")].map((row) => ({
      student: Number(row.dataset.student),
      status: row.querySelector("input:checked").value,
    }));
  }

  function summarize() {
    const rows = collect();
    const n = (status) => rows.filter((r) => r.status === status).length;
    const box = body.querySelector("#a-summary");
    if (box) box.textContent = `${rows.length} students · ${n("present")} present · ${n("late")} late · ${n("absent")} absent`;
  }

  page.querySelector("#a-course").addEventListener("change", (e) => {
    sel.course = Number(e.target.value);
    load();
  });
  page.querySelector("#a-date").addEventListener("change", (e) => {
    if (!e.target.value) return;
    sel.date = e.target.value;
    load();
  });
  body.addEventListener("change", summarize);

  page.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "all-present") {
      body.querySelectorAll('input[value="present"]').forEach((r) => (r.checked = true));
      summarize();
    }
    if (btn.dataset.act === "save") {
      const records = collect();
      if (!records.length) return toast("There are no students to save.", "error");
      btn.disabled = true;
      try {
        await api.attendance.save({ course: sel.course, date: sel.date, records });
        toast("Attendance saved.");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    }
  });

  load();
}
