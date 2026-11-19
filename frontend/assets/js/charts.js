// charts.js - two dependency-free charts: horizontal bars and a donut.
// Hand-built (HTML + SVG) so the project needs no chart library and loads fast.

import { esc } from "./ui.js";

export const GRADE_COLORS = {
  A: "#10b981",
  B: "#38bdf8",
  C: "#f59e0b",
  D: "#fb923c",
  F: "#f43f5e",
};

// items: [{ label: "CS101", value: 92.5 }]
export function barList(items, { suffix = "%", max = 100 } = {}) {
  if (!items.length) {
    return '<p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No data yet.</p>';
  }
  return `<ul class="space-y-4">${items
    .map((item) => {
      const width = Math.max(0, Math.min(100, (item.value / max) * 100));
      return `<li>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">${esc(item.label)}</span>
          <span class="tabular-nums text-slate-500 dark:text-slate-400">${item.value}${suffix}</span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style="width:${width}%"></div>
        </div>
      </li>`;
    })
    .join("")}</ul>`;
}

// items: [{ label: "A", value: 6, color: "#10b981" }]
//
// How the donut works: an SVG circle whose radius is 15.9155 has a
// circumference of exactly 100 units. So "stroke-dasharray: 30 70" paints a
// 30% arc. Each slice is a circle drawn with its own dash length and a
// dash offset that moves it to where the previous slice ended.
export function donut(items, centerLabel = "students") {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (!total) {
    return '<p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No grades recorded yet.</p>';
  }
  let offset = 0;
  const slices = items
    .filter((i) => i.value > 0)
    .map((i) => {
      const pct = (i.value / total) * 100;
      const dash = Math.max(pct - 0.8, 0.2); // small gap between slices
      const circle = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${i.color}" stroke-width="5"
        stroke-dasharray="${dash.toFixed(2)} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(25 - offset).toFixed(2)}"/>`;
      offset += pct;
      return circle;
    })
    .join("");

  const legend = items
    .map(
      (i) => `<li class="flex items-center justify-between gap-6 text-sm">
        <span class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span>${esc(i.label)}
        </span>
        <span class="tabular-nums font-medium text-slate-900 dark:text-white">${i.value}</span>
      </li>`
    )
    .join("");

  return `<div class="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
    <svg viewBox="0 0 42 42" class="h-40 w-40 shrink-0" role="img" aria-label="Grade distribution">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="currentColor" stroke-width="5" class="text-slate-100 dark:text-slate-800"/>
      ${slices}
      <text x="21" y="20" text-anchor="middle" font-size="7" font-weight="700" class="fill-slate-900 dark:fill-white">${total}</text>
      <text x="21" y="26" text-anchor="middle" font-size="3" class="fill-slate-500">${esc(centerLabel)}</text>
    </svg>
    <ul class="w-full space-y-2">${legend}</ul>
  </div>`;
}
