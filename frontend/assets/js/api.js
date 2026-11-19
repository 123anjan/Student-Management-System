// =============================================================================
// api.js - the single doorway between the screens and the data.
// =============================================================================
// Screens (app.js) only ever call   api.students.list()   api.grades.create(...)
// They never know whether the answer comes from:
//   * demoApi  (browser storage)   - MODE "demo"
//   * liveApi  (Django over HTTP)  - MODE "live"
// This pattern is called an ADAPTER. It is what lets one front-end run on
// GitHub Pages today and on a real server tomorrow without rewriting screens.

import { CONFIG } from "./config.js";
import { ApiError, extractMessage } from "./errors.js";
import { demoApi, resetDemoData } from "./demo-store.js";

const TOKEN_KEY = "edutrack_token";
const USER_KEY = "edutrack_user";
const ROLE_KEY = "edutrack_role";

const store = {
  get: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove: (key) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

function clearSession() {
  store.remove(TOKEN_KEY);
  store.remove(USER_KEY);
  store.remove(ROLE_KEY);
}

// -----------------------------------------------------------------------------
// LIVE mode: real HTTP calls to the Django REST API
// -----------------------------------------------------------------------------
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = store.get(TOKEN_KEY);
  // DRF "Token" authentication expects:  Authorization: Token <key>
  if (auth && token) headers.Authorization = `Token ${token}`;

  let response;
  try {
    response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the Django backend running and is API_BASE_URL correct?", 0);
  }

  if (response.status === 401 && auth) {
    clearSession();
    window.dispatchEvent(new Event("auth:expired")); // app.js listens and shows the login page
    throw new ApiError("Your session expired. Please sign in again.", 401);
  }
  if (response.status === 204) return null; // "No Content" - e.g. after DELETE

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(extractMessage(data), response.status, data);
  return data;
}

function query(params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
  const text = search.toString();
  return text ? `?${text}` : "";
}

// Standard REST routes that Django REST Framework's router creates for us:
//   GET /students/  POST /students/  PUT /students/5/  DELETE /students/5/
const crud = (base) => ({
  list: (params) => request(`${base}/${query(params)}`),
  create: (data) => request(`${base}/`, { method: "POST", body: data }),
  update: (id, data) => request(`${base}/${id}/`, { method: "PUT", body: data }),
  remove: (id) => request(`${base}/${id}/`, { method: "DELETE" }),
});

const liveApi = {
  auth: {
    login: (username, password) => request("/auth/login/", { method: "POST", body: { username, password }, auth: false }),
  },
  dashboard: () => request("/dashboard/"),
  students: crud("/students"),
  courses: crud("/courses"),
  attendance: {
    list: (params) => request(`/attendance/${query(params)}`),
    save: (payload) => request("/attendance/bulk/", { method: "POST", body: payload }),
  },
  grades: crud("/grades"),
};

// -----------------------------------------------------------------------------
// The object the rest of the app imports
// -----------------------------------------------------------------------------
const backend = CONFIG.MODE === "live" ? liveApi : demoApi;

export const api = {
  mode: CONFIG.MODE,
  role: () => store.get(ROLE_KEY) || (CONFIG.MODE === "demo" ? "principal" : ""),
  dashboard: backend.dashboard,
  students: backend.students,
  courses: backend.courses,
  attendance: backend.attendance,
  grades: backend.grades,

  auth: {
    isAuthenticated: () => Boolean(store.get(TOKEN_KEY)),
    username: () => store.get(USER_KEY) || "admin",
    async login(username, password) {
      const result = await backend.auth.login(username, password);
      store.set(TOKEN_KEY, result.token);
      store.set(USER_KEY, result.username || username);
      store.set(ROLE_KEY, result.role || "principal");
    },
    logout: clearSession,
  },

  // Only meaningful in demo mode (the button is hidden in live mode).
  resetDemo: resetDemoData,
};
