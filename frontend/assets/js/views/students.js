// views/students.js - list, search, filter, sort, paginate, add, edit, delete, export.
//
// Pattern used by every list screen:
//   1. load the data once (api call)
//   2. keep it in `state`
//   3. paint() = filter/sort/slice the state and redraw ONLY the table
// Redrawing only the table (not the search box) keeps keyboard focus while typing.

import { api } from "../api.js";
import { CONFIG } from "../config.js";
import { icon } from "../icons.js";
import {
  ui, esc, field, pageHeader, skeleton, emptyState, badge, avatar, fmtDate, todayISO,
  debounce, openModal, confirmDialog, toast, downloadCSV, selectBox, pager,
} from "../ui.js";

const state = { rows: [], courses: [], q: "", status: "", course: "", sort: "name", page: 1 };
let page = null; // the DOM element of the screen that is currently shown

const fullName = (s) => `${s.first_name} ${s.last_name}`;

const SORTERS = {
  name: (a, b) => fullName(a).localeCompare(fullName(b)),
  roll: (a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }),
  newest: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
};

function visibleRows() {
  const q = state.q.trim().toLowerCase();
  return state.rows
    .filter(
      (s) =>
        (!state.status || s.status === state.status) &&
        (!state.course || s.courses.includes(Number(state.course))) &&
        (!q || `${fullName(s)} ${s.roll_no} ${s.email}`.toLowerCase().includes(q))
    )
    .sort(SORTERS[state.sort]);
}

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(5);
  const [rows, courses] = await Promise.all([api.students.list(), api.courses.list()]);
  if (stale()) return;
  Object.assign(state, { rows, courses, page: 1 });

  page = mount(`
    ${pageHeader(
      "Students",
      "Add, search and manage every student record.",
      `<button type="button" data-act="export" class="${ui.btnGhost}">${icon("download", 16)} Export CSV</button>
       <button type="button" data-act="add" class="${ui.btnPrimary}">${icon("plus", 16)} Add student</button>`
    )}
    <div class="${ui.card} overflow-hidden">
      <div class="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto]">
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${icon("search", 16)}</span>
          <input id="s-q" type="search" value="${esc(state.q)}" placeholder="Search name, roll number or email..." class="${ui.input} pl-9" aria-label="Search students">
        </div>
        ${selectBox("s-status", "Filter by status", [["", "All statuses"], ["active", "Active"], ["inactive", "Inactive"], ["graduated", "Graduated"]], state.status)}
        ${selectBox("s-course", "Filter by course", [["", "All courses"], ...courses.map((c) => [c.id, c.code])], state.course)}
        ${selectBox("s-sort", "Sort students", [["name", "Sort: Name"], ["roll", "Sort: Roll no."], ["newest", "Sort: Newest"]], state.sort)}
      </div>
      <div id="s-table"></div>
    </div>
  `);

  page.querySelector("#s-q").addEventListener(
    "input",
    debounce((e) => {
      state.q = e.target.value;
      state.page = 1;
      paint();
    }, 150)
  );
  [["s-status", "status"], ["s-course", "course"], ["s-sort", "sort"]].forEach(([id, key]) => {
    page.querySelector(`#${id}`).addEventListener("change", (e) => {
      state[key] = e.target.value;
      state.page = 1;
      paint();
    });
  });
  page.addEventListener("click", onClick);
  paint();
}

function paint() {
  const host = page.querySelector("#s-table");
  const rows = visibleRows();
  if (!rows.length) {
    host.innerHTML = emptyState("No students found", "Try a different search or filter, or add a new student.");
    return;
  }
  const size = CONFIG.PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  state.page = Math.min(state.page, pages);
  const slice = rows.slice((state.page - 1) * size, state.page * size);
  const codes = new Map(state.courses.map((c) => [c.id, c.code]));

  const line = (s) => {
    const chips = s.courses.length
      ? s.courses
          .map((id) => `<span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(codes.get(id) ?? "?")}</span>`)
          .join("")
      : '<span class="text-slate-400">-</span>';
    return `<tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          ${avatar(s.first_name, s.last_name)}
          <div class="min-w-0">
            <p class="truncate font-medium">${esc(fullName(s))}</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">${esc(s.email)}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">${esc(s.roll_no)}</td>
      <td class="px-4 py-3"><div class="flex flex-wrap gap-1">${chips}</div></td>
      <td class="px-4 py-3">${badge(s.status)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">${fmtDate(s.enrolled_on)}</td>
      <td class="px-4 py-3">
        <div class="flex justify-end gap-1">
          <button type="button" data-act="edit" data-id="${s.id}" class="${ui.btnIcon}" aria-label="Edit ${esc(fullName(s))}">${icon("pencil", 16)}</button>
          <button type="button" data-act="delete" data-id="${s.id}" class="${ui.btnIcon} hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10" aria-label="Delete ${esc(fullName(s))}">${icon("trash", 16)}</button>
        </div>
      </td>
    </tr>`;
  };

  const th = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  host.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30">
          <tr><th class="${th}">Student</th><th class="${th}">Roll no.</th><th class="${th}">Courses</th><th class="${th}">Status</th><th class="${th}">Enrolled</th><th class="${th} text-right">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">${slice.map(line).join("")}</tbody>
      </table>
    </div>
    ${pager({ page: state.page, size, total: rows.length, label: "students" })}`;
}

async function onClick(e) {
  const btn = e.target.closest("[data-act],[data-nav]");
  if (!btn) return;
  if (btn.dataset.nav) {
    state.page += btn.dataset.nav === "next" ? 1 : -1;
    paint();
    return;
  }
  const { act, id } = btn.dataset;
  if (act === "add") return openForm(null);
  if (act === "export") return exportCsv();
  const student = state.rows.find((s) => s.id === Number(id));
  if (!student) return;
  if (act === "edit") return openForm(student);
  if (act === "delete") return removeStudent(student);
}

const GENDERS = [{ value: "", label: "Prefer not to say" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];
const STATUS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "graduated", label: "Graduated" }];

function openForm(student) {
  const s = student ?? { status: "active", enrolled_on: todayISO(), courses: [] };
  const courseBoxes = state.courses.length
    ? state.courses
        .map(
          (c) => `<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <input type="checkbox" name="courses" value="${c.id}" ${s.courses.includes(c.id) ? "checked" : ""} class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
            <span><strong>${esc(c.code)}</strong> <span class="text-slate-500 dark:text-slate-400">${esc(c.name)}</span></span>
          </label>`
        )
        .join("")
    : '<p class="text-sm text-slate-500">No courses yet. Create one on the Courses page first.</p>';

  openModal({
    title: student ? "Edit student" : "Add student",
    submitLabel: student ? "Save changes" : "Add student",
    wide: true,
    body: `<div class="grid gap-4 sm:grid-cols-2">
      ${field({ label: "First name", name: "first_name", value: s.first_name, required: true })}
      ${field({ label: "Last name", name: "last_name", value: s.last_name, required: true })}
      ${field({ label: "Roll number", name: "roll_no", value: s.roll_no, required: true, placeholder: "STU-2026-025" })}
      ${field({ label: "Email", name: "email", type: "email", value: s.email, required: true })}
      ${field({ label: "Phone", name: "phone", type: "tel", value: s.phone })}
      ${field({ label: "Date of birth", name: "date_of_birth", type: "date", value: s.date_of_birth ?? "", attrs: `max="${todayISO()}"` })}
      ${field({ label: "Gender", name: "gender", value: s.gender ?? "", options: GENDERS })}
      ${field({ label: "Status", name: "status", value: s.status, options: STATUS })}
      ${field({ label: "Enrolled on", name: "enrolled_on", type: "date", value: s.enrolled_on })}
      <div></div>
      ${field({ label: "Address", name: "address", type: "textarea", value: s.address, span: "sm:col-span-2" })}
      <fieldset class="sm:col-span-2">
        <legend class="${ui.label}">Courses</legend>
        <div class="grid gap-2 sm:grid-cols-2">${courseBoxes}</div>
      </fieldset>
    </div>`,
    async onSubmit(data) {
      const payload = {
        roll_no: data.roll_no.trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || "",
        address: data.address.trim(),
        status: data.status,
        enrolled_on: data.enrolled_on || todayISO(),
        courses: [].concat(data.courses ?? []).map(Number), // one box -> string, many -> array
      };
      if (student) await api.students.update(student.id, payload);
      else await api.students.create(payload);
      state.rows = await api.students.list();
      paint();
      toast(student ? "Student updated." : "Student added.");
    },
  });
}

async function removeStudent(student) {
  const yes = await confirmDialog({
    title: `Delete ${fullName(student)}?`,
    message: "This also removes their attendance and grade records. This cannot be undone.",
  });
  if (!yes) return;
  try {
    await api.students.remove(student.id);
    state.rows = state.rows.filter((s) => s.id !== student.id);
    paint();
    toast("Student deleted.");
  } catch (err) {
    toast(err.message, "error");
  }
}

function exportCsv() {
  const codes = new Map(state.courses.map((c) => [c.id, c.code]));
  const rows = visibleRows().map((s) => [
    s.roll_no, s.first_name, s.last_name, s.email, s.phone, s.gender, s.date_of_birth ?? "",
    s.status, s.enrolled_on, s.courses.map((id) => codes.get(id)).join(" | "), s.address,
  ]);
  downloadCSV(`students-${todayISO()}.csv`, [
    ["Roll no", "First name", "Last name", "Email", "Phone", "Gender", "Date of birth", "Status", "Enrolled on", "Courses", "Address"],
    ...rows,
  ]);
  toast(`Exported ${rows.length} students.`);
}
