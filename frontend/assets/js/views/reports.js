import { api } from "../api.js";
import { ui, esc, pageHeader, badge } from "../ui.js";

const roleAreas = [
  ["Registrar", "Admissions, student records, enrollment"],
  ["Teacher", "Classes, attendance and assessments"],
  ["Student", "Personal courses, attendance and grades"],
  ["Accountant", "Fee accounts and payment tracking"],
  ["Librarian", "Book catalogue and circulation"],
  ["Principal / Head", "School-wide oversight and reports"],
];

export async function render({ el, stale, mount }) {
  const report = await api.dashboard();
  if (stale()) return;
  const statusItems = Object.entries(report.status_breakdown).map(([key, count]) => `<li class="flex items-center justify-between py-3">${badge(key)}<span class="font-semibold">${count}</span></li>`).join("");
  mount(`
    ${pageHeader("Leadership reports", "A school-wide snapshot of enrollment and academic progress.")}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${[
        ["Total students", report.total_students, "All recorded learners"],
        ["Active students", report.active_students, "Currently enrolled"],
        ["Attendance rate", `${report.attendance_rate}%`, "Present or late"],
        ["Average score", `${report.average_score}%`, "Across recorded assessments"],
      ].map(([label, value, note]) => `<article class="${ui.card} p-5"><p class="text-sm text-slate-500">${label}</p><p class="mt-2 text-3xl font-bold">${esc(value)}</p><p class="mt-1 text-xs text-slate-400">${note}</p></article>`).join("")}
    </div>
    <div class="mt-5 grid gap-5 xl:grid-cols-2">
      <section class="${ui.card} p-5"><h2 class="font-semibold">Enrollment status</h2><ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">${statusItems}</ul></section>
      <section class="${ui.card} p-5"><h2 class="font-semibold">Role workspaces</h2><ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">${roleAreas.map(([role, desc]) => `<li class="py-3"><p class="font-medium">${role}</p><p class="text-sm text-slate-500">${desc}</p></li>`).join("")}</ul></section>
    </div>`);
}
