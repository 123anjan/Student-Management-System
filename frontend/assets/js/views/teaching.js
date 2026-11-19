import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, pageHeader, skeleton, avatar } from "../ui.js";

export async function render({ el, stale, mount }) {
  el.innerHTML = skeleton(3);
  const [courses, students] = await Promise.all([api.courses.list(), api.students.list()]);
  if (stale()) return;
  const page = mount(`
    ${pageHeader("Teaching workspace", "Your classes, rosters and assessment tools.")}
    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      ${[
        ["Teaching groups", courses.length],
        ["Enrolled learners", students.length],
        ["Assessment tools", "Attendance + grades"],
      ].map(([label, value]) => `<article class="${ui.card} p-5"><p class="text-sm text-slate-500">${label}</p><p class="mt-2 text-2xl font-bold">${esc(value)}</p></article>`).join("")}
    </div>
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
      <section class="${ui.card} overflow-hidden"><div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">My classes</h2><p class="mt-1 text-sm text-slate-500">Open a class to review its roster.</p></div>
        <div class="divide-y divide-slate-100 dark:divide-slate-800">${courses.map((course) => {
          const roster = students.filter((student) => student.courses.includes(course.id));
          return `<article class="p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><span class="font-mono text-xs font-semibold text-indigo-600">${esc(course.code)}</span><h3 class="font-semibold">${esc(course.name)}</h3><p class="text-sm text-slate-500">${esc(course.instructor || "Instructor")}</p></div><span class="text-sm text-slate-500">${roster.length} learners</span></div>
            <div class="mt-3 flex flex-wrap gap-2">${roster.slice(0, 6).map((student) => `<span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">${avatar(student.first_name, student.last_name, "h-6 w-6 text-[10px]")} ${esc(student.first_name)} ${esc(student.last_name)}</span>`).join("")}${roster.length > 6 ? `<span class="self-center text-xs text-slate-500">+${roster.length - 6} more</span>` : ""}</div></article>`;
        }).join("")}</div>
      </section>
      <aside class="${ui.card} p-5"><h2 class="font-semibold">Teaching tools</h2><p class="mt-1 text-sm text-slate-500">Jump to your day-to-day class tasks.</p>
        <div class="mt-4 grid gap-3"><a href="#/attendance" class="${ui.btnPrimary}">${icon("calendar", 16)} Take attendance</a><a href="#/grades" class="${ui.btnGhost}">${icon("award", 16)} Record grades</a><a href="#/courses" class="${ui.btnGhost}">${icon("book", 16)} Browse courses</a></div>
      </aside>
    </div>`);
}
