import { icon } from "../icons.js";
import { ui, esc, pageHeader, badge, toast } from "../ui.js";
import { portalStore } from "../portal-store.js";

const money = (amount) => new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export async function render({ el, mount }) {
  const page = mount(`<div id="finance-page"></div>`);
  const paint = () => {
    const fees = portalStore.list("fees");
    const due = fees.filter((fee) => fee.status !== "Paid").reduce((sum, fee) => sum + fee.amount, 0);
    page.innerHTML = `
      ${pageHeader("Fee management", "Review student balances and record fee payments.")}
      <div class="mb-5 grid gap-4 sm:grid-cols-3">
        ${[
          ["Collected", money(fees.filter((fee) => fee.status === "Paid").reduce((sum, fee) => sum + fee.amount, 0)), "bg-emerald-100 text-emerald-700"],
          ["Outstanding", money(due), "bg-amber-100 text-amber-700"],
          ["Accounts", String(fees.length), "bg-indigo-100 text-indigo-700"],
        ].map(([label, value, tone]) => `<article class="${ui.card} p-5"><p class="text-sm text-slate-500">${label}</p><p class="mt-2 text-2xl font-bold">${value}</p><span class="mt-3 inline-flex rounded-full px-2 py-1 text-xs ${tone}">${label}</span></article>`).join("")}
      </div>
      <section class="${ui.card} overflow-hidden"><div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">Student fee accounts</h2><p class="mt-1 text-sm text-slate-500">Demo ledger data is stored in this browser.</p></div>
        <div class="overflow-x-auto"><table class="w-full min-w-[640px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/40"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Term</th><th class="px-4 py-3">Amount</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Action</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">${fees.map((fee) => `<tr><td class="px-4 py-3"><p class="font-medium">${esc(fee.student)}</p><p class="text-xs text-slate-500">${esc(fee.roll)}</p></td><td class="px-4 py-3">${esc(fee.term)}</td><td class="px-4 py-3 font-semibold">${money(fee.amount)}</td><td class="px-4 py-3">${badge(fee.status === "Paid" ? "active" : "inactive", fee.status)}</td><td class="px-4 py-3 text-right">${fee.status === "Paid" ? `<span class="text-xs text-slate-400">Settled</span>` : `<button class="${ui.btnPrimary} !px-3 !py-1.5" data-paid="${fee.id}">${icon("check", 14)} Record payment</button>`}</td></tr>`).join("")}</tbody></table></div>
      </section>`;
  };
  page.addEventListener("click", (event) => {
    const button = event.target.closest("[data-paid]");
    if (!button) return;
    portalStore.update("fees", button.dataset.paid, { status: "Paid" });
    paint();
    toast("Payment recorded.");
  });
  paint();
}
