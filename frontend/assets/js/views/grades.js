// views/grades.js - record assessments, see each student's percentage + letter grade.

import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, field, pageHeader, skeleton, emptyState, badge, avatar, fmtDate, todayISO, openModal, confirmDialog, toast, selectBox } from "../ui.js";
import { letterFor, percent } from "../grading.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(5);
  const [courses, students] = await Promise.all([api.courses.list(), api.students.list()]);
  if (stale()) return;

  let course = courses[0]?.id ?? "";
  let grades = [];

  const page = mount(`
    ${pageHeader(
      "Grades",
      "Record assessment scores. Letter grades are calculated automatically.",
      `<button type="button" data-act="add" class="${ui.btnPrimary}" ${courses.length ? "" : "disabled"}>${icon("plus", 16)} Add grade</button>`
    )}
    <div class="${ui.card} overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
        ${courses.length ? selectBox("g-course", "Course", courses.map((c) => [c.id, `${c.code} - ${c.name}`]), course) : ""}
        <p id="g-summary" class="text-sm text-slate-500 dark:text-slate-400 sm:ml-auto"></p>
      </div>
      <div id="g-body"></div>
    </div>
  `);

  const body = page.querySelector("#g-body");
  const nameOf = new Map(students.map((s) => [s.id, s]));

  async function load() {
    if (!course) {
      body.innerHTML = emptyState("No courses yet", "Create a course first, then record grades for it.");
      return;
    }
    body.innerHTML = '<div class="p-8 text-center text-sm text-slate-500">Loading...</div>';
    const mine = course;
    const rows = await api.grades.list({ course });
    if (mine !== course || stale()) return;
    grades = rows;
    paint();
  }

  function paint() {
    const box = page.querySelector("#g-summary");
    if (!grades.length) {
      box.textContent = "";
      body.innerHTML = emptyState("No grades recorded", "Press 'Add grade' to record the first score for this course.");
      return;
    }

    // Combine every assessment of one student into a single overall percentage.
    const totals = new Map();
    grades.forEach((g) => {
      const t = totals.get(g.student) ?? { score: 0, max: 0 };
      t.score += g.score;
      t.max += g.max_score;
      totals.set(g.student, t);
    });
    const classAvg = [...totals.values()].reduce((sum, t) => sum + percent(t.score, t.max), 0) / totals.size;
    box.textContent = `${grades.length} entries · class average ${classAvg.toFixed(1)}%`;

    const th = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
    const sorted = [...grades].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    body.innerHTML = `<div class="overflow-x-auto"><table class="w-full min-w-[720px] text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30">
        <tr><th class="${th}">Student</th><th class="${th}">Assessment</th><th class="${th}">Score</th><th class="${th}">Grade</th><th class="${th}">Date</th><th class="${th} text-right">Actions</th></tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">${sorted
        .map((g) => {
          const s = nameOf.get(g.student);
          const pct = percent(g.score, g.max_score);
          const letter = letterFor(pct);
          return `<tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
            <td class="px-4 py-3"><div class="flex items-center gap-3">${s ? avatar(s.first_name, s.last_name) : ""}<span class="font-medium">${s ? `${esc(s.first_name)} ${esc(s.last_name)}` : "Unknown"}</span></div></td>
            <td class="px-4 py-3">${esc(g.title)}</td>
            <td class="px-4 py-3 tabular-nums">${g.score} / ${g.max_score} <span class="text-xs text-slate-400">(${pct.toFixed(0)}%)</span></td>
            <td class="px-4 py-3">${badge(letter, letter)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">${fmtDate(g.date)}</td>
            <td class="px-4 py-3"><div class="flex justify-end gap-1">
              <button type="button" data-act="edit" data-id="${g.id}" class="${ui.btnIcon}" aria-label="Edit grade">${icon("pencil", 16)}</button>
              <button type="button" data-act="delete" data-id="${g.id}" class="${ui.btnIcon} hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10" aria-label="Delete grade">${icon("trash", 16)}</button>
            </div></td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function openForm(grade) {
    const roster = students
      .filter((s) => s.courses.includes(Number(course)))
      .sort((a, b) => a.first_name.localeCompare(b.first_name));
    if (!roster.length && !grade) {
      toast("Enrol students in this course first.", "error");
      return;
    }
    const g = grade ?? { max_score: 100, date: todayISO() };
    openModal({
      title: grade ? "Edit grade" : "Add grade",
      submitLabel: grade ? "Save changes" : "Add grade",
      body: `<div class="grid gap-4 sm:grid-cols-2">
        ${field({
          label: "Student",
          name: "student",
          value: g.student,
          required: true,
          span: "sm:col-span-2",
          options: (grade ? students : roster).map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name} (${s.roll_no})` })),
        })}
        ${field({ label: "Assessment", name: "title", value: g.title, required: true, placeholder: "Midterm", span: "sm:col-span-2" })}
        ${field({ label: "Score", name: "score", type: "number", value: g.score ?? "", required: true, attrs: 'min="0" step="0.1"' })}
        ${field({ label: "Out of", name: "max_score", type: "number", value: g.max_score, required: true, attrs: 'min="1" step="0.1"' })}
        ${field({ label: "Date", name: "date", type: "date", value: g.date })}
      </div>`,
      async onSubmit(data) {
        const payload = {
          student: Number(data.student),
          course: Number(course),
          title: data.title.trim(),
          score: Number(data.score),
          max_score: Number(data.max_score),
          date: data.date || todayISO(),
        };
        if (grade) await api.grades.update(grade.id, payload);
        else await api.grades.create(payload);
        await load();
        toast(grade ? "Grade updated." : "Grade added.");
      },
    });
  }

  page.querySelector("#g-course")?.addEventListener("change", (e) => {
    course = Number(e.target.value);
    load();
  });

  page.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "add") return openForm(null);
    const grade = grades.find((x) => x.id === Number(btn.dataset.id));
    if (!grade) return;
    if (btn.dataset.act === "edit") return openForm(grade);
    if (btn.dataset.act === "delete") {
      if (!(await confirmDialog({ title: "Delete this grade?", message: `"${grade.title}" will be removed permanently.` }))) return;
      try {
        await api.grades.remove(grade.id);
        await load();
        toast("Grade deleted.");
      } catch (err) {
        toast(err.message, "error");
      }
    }
  });

  load();
}
