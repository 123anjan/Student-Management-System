// =============================================================================
// app.js - entry point: login screen, app shell (sidebar + top bar), router.
// =============================================================================
// ROUTING: this is a "single page application" (SPA). There is only one HTML
// file. When you click "Students", the URL becomes  index.html#/students.
// The part after "#" is the "hash". The browser fires a "hashchange" event and
// we draw the matching view. Hash routing is used on purpose: GitHub Pages
// cannot rewrite URLs, so a path like /students would give a 404 on refresh.

import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { icon } from "./icons.js";
import { ui, esc, toast, closeModal, confirmDialog } from "./ui.js";

const ROUTES = {
  "/dashboard": { label: "Dashboard", icon: "dashboard", load: () => import("./views/dashboard.js") },
  "/students": { label: "Students", icon: "users", load: () => import("./views/students.js") },
  "/courses": { label: "Courses", icon: "book", load: () => import("./views/courses.js") },
  "/attendance": { label: "Attendance", icon: "calendar", load: () => import("./views/attendance.js") },
  "/grades": { label: "Grades", icon: "award", load: () => import("./views/grades.js") },
};

const ROLE_ROUTES = {
  principal: Object.keys(ROUTES),
  teacher: ["/dashboard", "/students", "/courses", "/attendance", "/grades"],
  student: ["/dashboard", "/courses", "/attendance", "/grades"],
  registrar: ["/dashboard", "/students", "/courses"],
  accountant: ["/dashboard", "/students"],
  librarian: ["/dashboard", "/courses"],
};

const root = document.getElementById("app");
let navId = 0; // increases on every navigation; lets slow views detect they are outdated

// ---------------------------------------------------------------------------
// Theme (light / dark)
// ---------------------------------------------------------------------------
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("edutrack_theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  const btn = document.getElementById("theme-btn");
  if (btn) btn.innerHTML = icon(dark ? "sun" : "moon", 18);
}

// ---------------------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------------------
function showLogin() {
  closeModal();
  const demo = api.mode === "demo";
  root.innerHTML = `
    <main class="grid min-h-screen lg:grid-cols-2">
      <section class="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div class="flex items-center gap-3 text-lg font-bold">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">${icon("cap", 22)}</span>${esc(CONFIG.APP_NAME)}
        </div>
        <div>
          <h1 class="text-4xl font-bold leading-tight tracking-tight">Everything about your students,<br>in one calm place.</h1>
          <p class="mt-4 max-w-md text-indigo-100">Manage records, courses, daily attendance and grades with a fast, modern workspace.</p>
        </div>
        <p class="text-sm text-indigo-200">Full-stack: Django REST API + Tailwind front-end</p>
        <div class="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl"></div>
        <div class="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl"></div>
      </section>

      <section class="flex items-center justify-center p-6">
        <div class="animate-in w-full max-w-sm">
          <div class="mb-8 flex items-center gap-3 lg:hidden">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">${icon("cap", 22)}</span>
            <span class="text-lg font-bold">${esc(CONFIG.APP_NAME)}</span>
          </div>
          <h2 class="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to open your dashboard.</p>

          ${demo ? `<div class="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            <strong>Demo mode.</strong> Data stays in your browser.<br>
            Accounts: <code class="font-mono">admin</code> / <code class="font-mono">admin123</code>, or
            <code class="font-mono">principal</code>, <code class="font-mono">registrar</code>,
            <code class="font-mono">teacher</code>, <code class="font-mono">student</code>,
            <code class="font-mono">accountant</code>, <code class="font-mono">librarian</code>
            with the matching <code class="font-mono">role123</code> password.</div>` : ""}

          <form id="login" class="mt-6 space-y-4" novalidate>
            <div><label for="u" class="${ui.label}">Username</label>
              <input id="u" name="username" autocomplete="username" required class="${ui.input}" value="${demo ? "admin" : ""}"></div>
            <div><label for="p" class="${ui.label}">Password</label>
              <input id="p" name="password" type="password" autocomplete="current-password" required class="${ui.input}" value="${demo ? "admin123" : ""}"></div>
            <p id="login-error" class="hidden rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert"></p>
            <button class="${ui.btnPrimary} w-full !py-2.5" type="submit">Sign in</button>
          </form>
          <button type="button" id="theme-login" class="mt-6 text-xs text-slate-500 hover:underline dark:text-slate-400">Toggle light / dark</button>
        </div>
      </section>
    </main>`;

  document.getElementById("theme-login").addEventListener("click", toggleTheme);
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = document.getElementById("login-error");
    const btn = form.querySelector("button[type=submit]");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Signing in...";
    try {
      await api.auth.login(form.username.value.trim(), form.password.value);
      location.hash = "#/dashboard";
      showShell();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
}

// ---------------------------------------------------------------------------
// App shell: sidebar (desktop) / drawer (mobile) + top bar + page area
// ---------------------------------------------------------------------------
function showShell() {
  const isDark = document.documentElement.classList.contains("dark");
  const role = api.role();
  const roleLabel = ({
    principal: "Principal / Head",
    registrar: "Registrar",
    teacher: "Teacher",
    student: "Student",
    accountant: "Accountant",
    librarian: "Librarian",
  })[role] || role;
  const allowedRoutes = new Set(ROLE_ROUTES[role] || ["/dashboard"]);
  const visibleRoutes = Object.entries(ROUTES).filter(([path]) => allowedRoutes.has(path));
  const link = ([path, r]) => `
    <a href="#${path}" data-route="${path}" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
      ${icon(r.icon, 18)}<span>${r.label}</span></a>`;

  root.innerHTML = `
    <div class="min-h-screen lg:pl-64">
      <div id="scrim" class="fixed inset-0 z-30 hidden bg-slate-900/50 lg:hidden"></div>
      <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0">
        <div class="flex h-16 items-center gap-3 px-5">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">${icon("cap", 20)}</span>
          <span class="text-lg font-bold tracking-tight">${esc(CONFIG.APP_NAME)}</span>
        </div>
        <nav class="flex-1 space-y-1 px-3 py-2" aria-label="Main">${visibleRoutes.map(link).join("")}</nav>
        <div class="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
          ${api.mode === "demo" ? `<button type="button" id="reset-demo" class="${ui.btnGhost} w-full !justify-start !text-xs">${icon("reset", 14)} Reset demo data</button>` : ""}
          <div class="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">${esc(api.auth.username().slice(0, 1).toUpperCase())}</span>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">${esc(api.auth.username())}</p><p class="text-xs text-slate-500 dark:text-slate-400">${esc(roleLabel)}</p></div>
            <button type="button" id="logout" class="${ui.btnIcon}" aria-label="Sign out" title="Sign out">${icon("logout", 18)}</button>
          </div>
        </div>
      </aside>

      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
        <button type="button" id="open-menu" class="${ui.btnIcon} lg:hidden" aria-label="Open menu">${icon("menu", 20)}</button>
        <p id="crumb" class="text-sm font-semibold"></p>
        <div class="ml-auto flex items-center gap-1">
          <button type="button" id="theme-btn" class="${ui.btnIcon}" aria-label="Toggle dark mode">${icon(isDark ? "sun" : "moon", 18)}</button>
        </div>
      </header>

      <main id="page" class="mx-auto max-w-7xl p-4 sm:p-6" tabindex="-1"></main>
    </div>`;

  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  const setMenu = (open) => {
    sidebar.classList.toggle("-translate-x-full", !open);
    scrim.classList.toggle("hidden", !open);
  };
  document.getElementById("open-menu").addEventListener("click", () => setMenu(true));
  scrim.addEventListener("click", () => setMenu(false));
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("logout").addEventListener("click", () => {
    api.auth.logout();
    location.hash = "";
    showLogin();
  });
  document.getElementById("reset-demo")?.addEventListener("click", async () => {
    const yes = await confirmDialog({ title: "Reset demo data?", message: "All changes you made are replaced by the original sample data.", confirmLabel: "Reset" });
    if (!yes) return;
    api.resetDemo();
    toast("Demo data restored.");
    route();
  });
  sidebar.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));

  route();
}

// ---------------------------------------------------------------------------
// Router: find the view for the current hash and draw it
// ---------------------------------------------------------------------------
async function route() {
  const page = document.getElementById("page");
  if (!page) return;
  const path = location.hash.replace(/^#/, "") || "/dashboard";
  const role = api.role();
  const allowedRoutes = new Set(ROLE_ROUTES[role] || ["/dashboard"]);
  if (!allowedRoutes.has(path)) {
    location.hash = "#/dashboard";
    return;
  }
  const def = ROUTES[path];
  if (!def) {
    location.hash = "#/dashboard";
    return;
  }

  closeModal();
  const mine = ++navId;
  const stale = () => mine !== navId;

  document.querySelectorAll("[data-route]").forEach((a) => {
    const on = a.dataset.route === path;
    a.classList.toggle("bg-indigo-50", on);
    a.classList.toggle("text-indigo-700", on);
    a.classList.toggle("dark:bg-indigo-500/10", on);
    a.classList.toggle("dark:text-indigo-300", on);
    a.setAttribute("aria-current", on ? "page" : "false");
  });
  document.getElementById("crumb").textContent = def.label;
  document.title = `${def.label} - ${CONFIG.APP_NAME}`;

  try {
    const view = await def.load();
    if (stale()) return;
    await view.render({
      el: page,
      stale,
      // mount() draws the final HTML (with a fade-in) and returns a BRAND-NEW
      // wrapper element. This matters: views attach click listeners to what
      // mount() returns. If we returned the shared #page element, listeners
      // from every previously visited screen would pile up on it and fire
      // together (e.g. "Add" on Students would also run the Grades handler).
      // A fresh wrapper per screen is thrown away with its listeners.
      mount(html) {
        const wrapper = document.createElement("div");
        wrapper.className = "animate-in";
        wrapper.innerHTML = html;
        page.replaceChildren(wrapper);
        return wrapper;
      },
    });
  } catch (err) {
    if (stale() || err?.status === 401) return; // 401 is handled by "auth:expired"
    page.innerHTML = `<div class="${ui.card} p-10 text-center">
      <p class="text-base font-semibold">We could not load this page</p>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${esc(err?.message || "Unknown error")}</p>
      <button type="button" id="retry" class="${ui.btnPrimary} mt-5">Try again</button></div>`;
    document.getElementById("retry")?.addEventListener("click", route);
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
window.addEventListener("hashchange", route);
window.addEventListener("auth:expired", () => {
  showLogin();
  toast("Your session expired. Please sign in again.", "error");
});

if (api.auth.isAuthenticated()) showShell();
else showLogin();
