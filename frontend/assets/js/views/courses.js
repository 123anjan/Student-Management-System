// views/courses.js - course catalogue as cards, with add / edit / delete.

import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, field, pageHeader, skeleton, emptyState, openModal, confirmDialog, toast } from "../ui.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(3);
  const canManage = ["principal", "registrar", "teacher"].includes(api.role());
  let courses = await api.courses.list();
  if (stale()) return;

  const page = mount(`
    ${pageHeader(
      "Courses",
      "The subjects students can enrol in.",
      ${canManage ? `<button type="button" data-act="add" class="${ui.btnPrimary}">${icon("plus", 16)} Add course</button>` : ""}`
    )}
    <div id="c-grid"></div>
  `);

  const paint = () => {
    const grid = page.querySelector("#c-grid");
    if (!courses.length) {
      grid.innerHTML = `<div class="${ui.card}">${emptyState("No courses yet", "Create your first course to start enrolling students.")}</div>`;
      return;
    }
    grid.innerHTML = `<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${courses
      .map(
        (c) => `<article class="${ui.card} flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-3">
            <span class="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">${esc(c.code)}</span>
            ${canManage ? `<div class="flex gap-1">
              <button type="button" data-act="edit" data-id="${c.id}" class="${ui.btnIcon}" aria-label="Edit ${esc(c.code)}">${icon("pencil", 16)}</button>
              <button type="button" data-act="delete" data-id="${c.id}" class="${ui.btnIcon} hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10" aria-label="Delete ${esc(c.code)}">${icon("trash", 16)}</button>
            </div>` : ""}
          </div>
          <h2 class="mt-3 text-base font-semibold leading-snug">${esc(c.name)}</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${esc(c.instructor || "No instructor assigned")}</p>
          <div class="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span class="inline-flex items-center gap-1.5">${icon("users", 15)} ${c.student_count ?? 0} students</span>
            <span class="inline-flex items-center gap-1.5">${icon("award", 15)} ${c.credits} credits</span>
          </div>
        </article>`
      )
      .join("")}</div>`;
  };

  const reload = async () => {
    courses = await api.courses.list();
    paint();
  };

  const openForm = (course) => {
    const c = course ?? { credits: 3 };
    openModal({
      title: course ? "Edit course" : "Add course",
      submitLabel: course ? "Save changes" : "Add course",
      body: `<div class="grid gap-4 sm:grid-cols-2">
        ${field({ label: "Course code", name: "code", value: c.code, required: true, placeholder: "CS101" })}
        ${field({ label: "Credits", name: "credits", type: "number", value: c.credits, required: true, attrs: 'min="1" max="10" step="1"' })}
        ${field({ label: "Course name", name: "name", value: c.name, required: true, span: "sm:col-span-2" })}
        ${field({ label: "Instructor", name: "instructor", value: c.instructor, span: "sm:col-span-2" })}
      </div>`,
      async onSubmit(data) {
        const payload = { code: data.code.trim(), name: data.name.trim(), instructor: data.instructor.trim(), credits: Number(data.credits) };
        if (course) await api.courses.update(course.id, payload);
        else await api.courses.create(payload);
        await reload();
        toast(course ? "Course updated." : "Course added.");
      },
    });
  };

  page.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "add") return openForm(null);
    const course = courses.find((c) => c.id === Number(btn.dataset.id));
    if (!course) return;
    if (btn.dataset.act === "edit") return openForm(course);
    if (btn.dataset.act === "delete") {
      const yes = await confirmDialog({
        title: `Delete ${course.code}?`,
        message: "Its attendance and grade records are removed too. Students stay in the system.",
      });
      if (!yes) return;
      try {
        await api.courses.remove(course.id);
        await reload();
        toast("Course deleted.");
      } catch (err) {
        toast(err.message, "error");
      }
    }
  });

  paint();
}
