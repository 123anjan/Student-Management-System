import { icon } from "../icons.js";
import { ui, esc, pageHeader, toast } from "../ui.js";
import { portalStore } from "../portal-store.js";

const stages = ["Review", "Interview", "Documents needed", "Accepted", "Declined"];

export async function render({ el, mount }) {
  const page = mount(`
    ${pageHeader("Admissions", "Track applicants from first review through enrollment.", `<span class="${ui.btnGhost}">${portalStore.list("admissions").length} applicants</span>`)}
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <section class="${ui.card} overflow-hidden">
        <div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">Applicant pipeline</h2><p class="mt-1 text-sm text-slate-500">Update an applicant's current stage.</p></div>
        <div id="admissions-list" class="divide-y divide-slate-100 dark:divide-slate-800"></div>
      </section>
      <form id="admission-form" class="${ui.card} space-y-4 p-5">
        <div><h2 class="font-semibold">Register applicant</h2><p class="mt-1 text-sm text-slate-500">Add a prospective student to the intake queue.</p></div>
        <label class="block text-sm">Applicant name<input name="name" required class="${ui.input} mt-1" placeholder="Full name"></label>
        <label class="block text-sm">Email<input name="email" type="email" required class="${ui.input} mt-1" placeholder="name@example.edu"></label>
        <label class="block text-sm">Program<input name="program" required class="${ui.input} mt-1" placeholder="Program of study"></label>
        <button class="${ui.btnPrimary} w-full" type="submit">${icon("plus", 16)} Add applicant</button>
      </form>
    </div>`);

  const list = page.querySelector("#admissions-list");
  const paint = () => {
    const rows = portalStore.list("admissions");
    list.innerHTML = rows.length ? rows.map((row) => `
      <article class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1"><p class="font-medium">${esc(row.name)}</p><p class="text-sm text-slate-500">${esc(row.email)} · ${esc(row.program)}</p></div>
        <select class="${ui.input} sm:w-48" data-stage="${row.id}" aria-label="Admissions stage for ${esc(row.name)}">
          ${stages.map((stage) => `<option ${stage === row.status ? "selected" : ""}>${stage}</option>`).join("")}
        </select>
      </article>`).join("") : `<p class="p-6 text-sm text-slate-500">No applicants yet.</p>`;
  };
  page.querySelector("#admission-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    portalStore.add("admissions", { name: data.get("name").trim(), email: data.get("email").trim(), program: data.get("program").trim(), status: "Review" });
    event.currentTarget.reset();
    paint();
    toast("Applicant added to admissions.");
  });
  list.addEventListener("change", (event) => {
    if (!event.target.matches("[data-stage]")) return;
    portalStore.update("admissions", event.target.dataset.stage, { status: event.target.value });
    toast("Applicant stage updated.");
  });
  paint();
}
