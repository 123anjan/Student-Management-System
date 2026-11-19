// =============================================================================
// ui.js - the "UI kit": design tokens + small reusable helpers.
// =============================================================================
// Why keep Tailwind class strings here?
//   Using the Tailwind CDN we cannot use @apply in a plain .css file, so we keep
//   each component style (button, input, card...) in ONE constant. Change the
//   constant, and every button/input in the app changes. That is a "design token".

import { icon } from "./icons.js";

export const ui = {
  card: "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
  label: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
  input:
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  btnDanger:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900",
  btnIcon:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
};

// ---------------------------------------------------------------------------
// SECURITY: esc() - escape text before putting it into innerHTML.
// Student names/addresses are typed by users. Without escaping, someone could
// save a name like  <img src=x onerror=alert(1)>  and run code in every
// browser that opens the list (this attack is called XSS). We escape EVERY
// piece of user data we place in HTML.
// ---------------------------------------------------------------------------
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------
export function todayISO(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10); // "2026-11-13"
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function initials(first = "", last = "") {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
];

// A coloured circle with the student's initials. The colour is derived from
// the name, so the same student always gets the same colour.
export function avatar(first, last, size = "h-9 w-9 text-xs") {
  let hash = 0;
  for (const ch of `${first}${last}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return `<span class="inline-flex ${size} shrink-0 items-center justify-center rounded-full font-semibold ${tone}">${esc(initials(first, last))}</span>`;
}

const BADGES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20",
  graduated: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20",
  present: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  late: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  absent: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
  A: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  B: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
  C: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  D: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20",
  F: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
};

export function badge(key, label = key) {
  const tone = BADGES[key] ?? BADGES.inactive;
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${tone}">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Form field builder - returns an HTML string for one labelled input.
// ---------------------------------------------------------------------------
export function field({ label, name, type = "text", value = "", required = false, placeholder = "", options = null, span = "", attrs = "" }) {
  const id = `f-${name}`;
  const star = required ? ' <span class="text-rose-500">*</span>' : "";
  let control;
  if (options) {
    control = `<select id="${id}" name="${name}" class="${ui.input}" ${required ? "required" : ""} ${attrs}>${options
      .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`)
      .join("")}</select>`;
  } else if (type === "textarea") {
    control = `<textarea id="${id}" name="${name}" rows="2" class="${ui.input}" placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`;
  } else {
    control = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" class="${ui.input}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} ${attrs}>`;
  }
  return `<div class="${span}"><label for="${id}" class="${ui.label}">${esc(label)}${star}</label>${control}</div>`;
}

// FormData -> plain object. Repeated names (checkboxes) become arrays.
export function formToObject(form) {
  const out = {};
  for (const [key, value] of new FormData(form)) {
    out[key] = key in out ? [].concat(out[key], value) : value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Toast notifications (small pop-up messages, bottom-right)
// ---------------------------------------------------------------------------
export function toast(message, type = "success") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.className = "fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const tone =
    type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950 dark:text-rose-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-200";
  const el = document.createElement("div");
  el.className = `animate-in flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${tone}`;
  el.innerHTML = `<span class="mt-0.5">${icon(type === "error" ? "alert" : "check", 16)}</span><span>${esc(message)}</span>`;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3400);
}

// ---------------------------------------------------------------------------
// Modal dialog with a form inside.
// onSubmit(dataObject) may be async. If it throws, the message is shown inside
// the dialog and the dialog stays open so the user can fix the problem.
// ---------------------------------------------------------------------------
let keyHandler = null;

export function closeModal() {
  document.getElementById("modal-root")?.remove();
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  keyHandler = null;
}

export function openModal({ title, body, submitLabel = "Save", onSubmit, wide = false }) {
  closeModal();
  const root = document.createElement("div");
  root.id = "modal-root";
  root.className = "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4";
  root.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
         class="animate-in flex max-h-[92vh] w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 id="modal-title" class="text-base font-semibold text-slate-900 dark:text-white">${esc(title)}</h2>
        <button type="button" data-close class="${ui.btnIcon}" aria-label="Close">${icon("x", 18)}</button>
      </div>
      <form class="flex min-h-0 flex-1 flex-col">
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          ${body}
          <p data-error class="hidden rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert"></p>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button type="button" data-close class="${ui.btnGhost}">Cancel</button>
          <button type="submit" class="${ui.btnPrimary}">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(root);

  root.addEventListener("mousedown", (e) => {
    if (e.target === root || e.target.closest("[data-close]")) closeModal();
  });
  keyHandler = (e) => e.key === "Escape" && closeModal();
  document.addEventListener("keydown", keyHandler);

  const form = root.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector("[type=submit]");
    const errorBox = form.querySelector("[data-error]");
    errorBox.classList.add("hidden");
    submit.disabled = true;
    try {
      await onSubmit(formToObject(form));
      closeModal();
    } catch (err) {
      errorBox.textContent = err?.message || "Something went wrong.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
    }
  });

  root.querySelector("input:not([type=hidden]), select, textarea")?.focus();
  return root;
}

// A small yes/no dialog. Returns a Promise<boolean>.
export function confirmDialog({ title, message, confirmLabel = "Delete" }) {
  return new Promise((resolve) => {
    document.getElementById("confirm-root")?.remove();
    const root = document.createElement("div");
    root.id = "confirm-root";
    root.className = "fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm";
    root.innerHTML = `
      <div role="alertdialog" aria-modal="true" class="animate-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">${icon("alert", 20)}</div>
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">${esc(title)}</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${esc(message)}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" data-no class="${ui.btnGhost}">Cancel</button>
          <button type="button" data-yes class="${ui.btnDanger}">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    const done = (answer) => {
      root.remove();
      document.removeEventListener("keydown", onKey);
      resolve(answer);
    };
    const onKey = (e) => e.key === "Escape" && done(false);
    document.addEventListener("keydown", onKey);
    root.addEventListener("mousedown", (e) => e.target === root && done(false));
    root.querySelector("[data-no]").addEventListener("click", () => done(false));
    root.querySelector("[data-yes]").addEventListener("click", () => done(true));
    document.body.appendChild(root);
    root.querySelector("[data-no]").focus();
  });
}

// ---------------------------------------------------------------------------
// Reusable page fragments
// ---------------------------------------------------------------------------
export function pageHeader(title, subtitle = "", actions = "") {
  return `<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">${esc(title)}</h1>
      ${subtitle ? `<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${esc(subtitle)}</p>` : ""}
    </div>
    <div class="flex flex-wrap gap-2">${actions}</div>
  </div>`;
}

export function emptyState(title, text = "") {
  return `<div class="flex flex-col items-center px-6 py-14 text-center">
    <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">${icon("inbox", 22)}</div>
    <p class="text-sm font-semibold text-slate-900 dark:text-white">${esc(title)}</p>
    ${text ? `<p class="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">${esc(text)}</p>` : ""}
  </div>`;
}

// Grey pulsing placeholders shown while data loads ("skeleton screen").
export function skeleton(rows = 3) {
  const bar = '<div class="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>';
  return `<div class="${ui.card} space-y-4 p-5" aria-busy="true" aria-label="Loading">
    <div class="h-6 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
    ${Array.from({ length: rows }, () => bar).join("")}
  </div>`;
}

// Download an array-of-arrays as a CSV file (opens in Excel / Google Sheets).
export function downloadCSV(filename, rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A <select> built from [[value, text], ...] pairs.
export function selectBox(id, label, options, value = "") {
  return `<select id="${id}" aria-label="${esc(label)}" class="${ui.input} md:w-auto">${options
    .map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`)
    .join("")}</select>`;
}

// "Showing 1-8 of 24" + previous/next buttons. The screen listens for clicks
// on [data-nav="prev"] and [data-nav="next"].
export function pager({ page, size, total, label = "records" }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const start = total ? (page - 1) * size + 1 : 0;
  const end = Math.min(total, page * size);
  return `<div class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
    <p class="text-slate-500 dark:text-slate-400">Showing <span class="font-medium text-slate-900 dark:text-white">${start}-${end}</span> of ${total} ${label}</p>
    <div class="flex items-center gap-2">
      <button type="button" data-nav="prev" class="${ui.btnGhost} !px-2.5 !py-1.5" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("left", 16)}</button>
      <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">${page} / ${pages}</span>
      <button type="button" data-nav="next" class="${ui.btnGhost} !px-2.5 !py-1.5" ${page >= pages ? "disabled" : ""} aria-label="Next page">${icon("right", 16)}</button>
    </div>
  </div>`;
}
