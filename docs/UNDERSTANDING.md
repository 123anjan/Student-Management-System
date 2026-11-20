# Understanding EduTrack, step by step

This guide explains **what each part does and why it exists**, so you can explain, change and defend every line. Read it in order once; afterwards use it as a map.

---

## 1. The big picture

A full-stack app has three layers that talk to each other:

```
 Browser (front-end)          Server (back-end)            Database
 HTML + Tailwind + JS   --->  Django REST API       --->   SQLite / MySQL
 what the user sees           rules + security             permanent storage
        <--- JSON ---                <--- rows ---
```

1. The user clicks "Add student" in the browser.
2. JavaScript sends an HTTP request (`POST /api/students/`) with the form data as **JSON**.
3. Django checks the data, checks the login token, saves a row in the database.
4. Django answers with JSON; JavaScript redraws the table.

**The GitHub Pages problem.** GitHub Pages only serves files (HTML/CSS/JS). It cannot run Python, so no Django, no database. This project solves it with a **demo mode**: a fake server written in JavaScript (`demo-store.js`) that saves data in the browser. The screens cannot tell the difference, so the *same front-end* works on GitHub Pages (demo) and with the real Django backend (live).

---

## 2. Front-end, file by file

### `index.html` - the shell
Almost empty on purpose: one `<div id="app">` and one `<script type="module">`. JavaScript draws everything else. It also:
- sets dark/light theme **before** the page paints (no white flash),
- loads the Inter font and Tailwind CSS from a CDN.

### Tailwind CSS
Instead of writing CSS files, you add small utility classes to elements: `rounded-lg` (rounded corners), `px-4` (horizontal padding), `dark:bg-slate-900` (colour used only in dark mode), `md:grid-cols-2` (two columns from medium screens up = responsive design). Benefit: fast, consistent design. For a very high-traffic production site you would compile Tailwind with its CLI so the browser downloads only the CSS it needs; the CDN is ideal for learning and demos.

### `config.js` - the only switch
`MODE: "demo"` or `"live"`, plus `API_BASE_URL`. Nothing else needs editing to change where data comes from.

### `api.js` - the adapter (the most important design idea)
Screens call `api.students.list()`. `api.js` decides:
- **demo** -> `demoApi` (browser storage),
- **live** -> `fetch()` calls to Django, adding the header `Authorization: Token <key>`.

This is the **adapter pattern**: one interface, two implementations. It also converts every failure into one `ApiError` type, so the UI shows errors the same way in both modes. If the server answers 401 (token expired), it fires an `auth:expired` event and the app returns to the login page.

### `demo-store.js` - the fake backend
Keeps four tables (students, courses, attendance, grades) as JSON in `localStorage`, creates 24 sample students on first visit with a seeded random generator (same data for everyone), and **re-implements the server rules**: required fields, unique roll number/email, score not above maximum, cascade deletes. It was tested with 23 automated checks. Demo notice metadata is stored in `localStorage`; attached PDFs use IndexedDB in the same browser and are not shared across browsers.

### `app.js` - login, layout, router
- **Router:** the URL hash (`#/students`) picks the screen. Hash routing is used because GitHub Pages cannot rewrite URLs; a path like `/students` would show a 404 on refresh.
- Screens are loaded with dynamic `import()`, so the browser downloads a screen's code only when you first open it.
- A counter (`navId`) lets slow screens notice "the user already went elsewhere" and stop, preventing a late response from drawing over the wrong page.
- `mount()` gives each screen a **fresh wrapper element**. (A bug found during testing: sharing one element made old click handlers stack up and fire on the wrong screen.)

### `ui.js` - the design system
- Reusable class strings (`ui.btnPrimary`, `ui.input`, `ui.card`): change one constant and the whole app updates.
- **`esc()` prevents XSS.** If someone saves the name `<img src=x onerror=alert(1)>`, unescaped HTML would run that code in every visitor's browser. `esc()` turns `<` into `&lt;` so it shows as text. Every piece of user data placed into HTML goes through `esc()`.
- Modal, confirm dialog, toasts, skeleton loaders, empty states, CSV export.

### Views (`views/`)
Each exports `render()`. Common pattern: **load data once -> keep it in `state` -> `paint()` filters/sorts/slices and redraws only the table.** Redrawing only the table keeps keyboard focus in the search box while you type.

| Screen | What to notice |
|---|---|
| Dashboard | One API call (`/dashboard/`) feeds stat cards and two hand-built charts (no chart library) |
| Students | Search (debounced), filters, sorting, pagination, add/edit modal, delete with confirmation, CSV export |
| Courses | Cards; deleting a course removes its attendance and grades |
| Attendance | Pick course + date, tap Present/Late/Absent, **one** save call for the whole class (upsert: saving twice never duplicates) |
| Grades | Percentage and letter grade computed from score and maximum |

### UX/UI decisions (why it feels modern)
- Clear hierarchy: one primary action per screen, secondary actions in ghost buttons.
- Feedback for every action: loading skeletons, toasts, inline form errors, empty states that say what to do next.
- Dark mode that follows the OS and remembers your choice.
- Mobile first: sidebar becomes a drawer, tables scroll sideways, modals slide up from the bottom.
- Accessibility: real `<label>`s, `aria-label` on icon buttons, visible keyboard focus rings, `Esc` closes dialogs, dialogs use `role="dialog"`, and `prefers-reduced-motion` is respected.

---

## 3. Back-end, file by file

### `config/settings.py`
Everything environment-specific comes from `.env` / environment variables: secret key, debug flag, allowed hosts, CORS origins, database. If `DJANGO_SECRET_KEY` is missing and debug is off, the app **refuses to start** instead of running insecurely. `DEBUG=0` hides error details from attackers.

Key settings explained:
- `INSTALLED_APPS`: includes `rest_framework`, `rest_framework.authtoken` (the token table), `corsheaders`, and our `students` app.
- `REST_FRAMEWORK`: default permission `IsAuthenticated` means **every endpoint is locked unless explicitly opened** (safe by default). Login is throttled to 10 tries/minute.
- **CORS:** browsers block a page on `github.io` from calling a different domain unless that server says it is allowed. `CORS_ALLOWED_ORIGINS` is that allow-list.
- `WHITENOISE_ROOT`: lets Django also serve the `frontend` folder, so one deployment hosts everything.

### `students/models.py` - the database design
```
Course 1 ---< Attendance >--- 1 Student
Course 1 ---< Grade      >--- 1 Student
Student >---< Course      (many-to-many)
```
- `unique=True` on roll number, email and course code.
- `UniqueConstraint(student, course, date)` on Attendance: the **database itself** forbids two attendance rows for the same student, course and day.
- `on_delete=CASCADE`: deleting a student deletes their attendance and grades, so no orphan rows remain.
- A model class = one table; each field = one column.

### Migrations
Models are Python; the database needs tables. `makemigrations` writes a "blueprint" file describing the change; `migrate` applies it. Commit the migration files to Git so every environment builds identical tables.

### `students/serializers.py` - validation gate
Converts model objects to JSON and **validates incoming JSON before it reaches the database**. Examples: email lower-cased and checked for duplicates case-insensitively; a grade's score cannot exceed its maximum; course code upper-cased. Errors return HTTP 400 as `{"roll_no": ["student with this roll no already exists."]}`, which `errors.js` shows as a readable message.

### `students/views.py`
- `LoginView`: checks username/password, returns a **token**. The browser stores it and sends it with every request. (Passwords are never stored in the browser.)
- `ModelViewSet`s: ready-made list/create/read/update/delete.
- `prefetch_related` / `annotate`: fetch related data in a few queries instead of one query per row (avoids the "N+1 query problem").
- `bulk` attendance runs inside `transaction.atomic()`: **all students save or none do**.
- `DashboardView`: computes the statistics in the database.

### `students/urls.py`
A `DefaultRouter` turns each ViewSet into the standard REST routes, e.g. `GET /api/students/` and `PUT /api/students/5/`.

### `tests.py`
Automated tests for login, authorization (401 without a token), duplicates, cascades, bulk upsert, validation and dashboard maths. Run `python manage.py test` before every deployment.

### `seed_demo` command
Creates the admin user (the password is hashed with `set_password`) and sample data. The password is passed on the command line, so no default password ships with the backend.

---

## 4. One request, traced end to end (live mode)

"Add student" with roll number `STU-9`:

1. `students.js` `onSubmit` builds a payload and calls `api.students.create(payload)`.
2. `api.js` -> `request("/students/", {method:"POST", body})` -> `fetch("https://.../api/students/", ...)` with `Authorization: Token abc...`.
3. Django: `TokenAuthentication` finds the user; `IsAuthenticated` passes.
4. `StudentSerializer` validates; if `STU-9` exists -> HTTP 400 `{"roll_no": [...]}`.
5. Otherwise a row is inserted, and `201 Created` plus the new student JSON is returned.
6. JavaScript reloads the list, redraws the table, shows a "Student added" toast.
7. On error, `ApiError` carries the message; the modal stays open and shows it.

---

## 5. Security summary

| Threat | Defence in this project |
|---|---|
| Anonymous access | Token auth; all endpoints locked by default |
| Password guessing | Login throttled; password hashing; strong password required in production |
| XSS (script injection) | `esc()` on all user data placed in HTML |
| SQL injection | Django ORM uses parameterised queries; no raw SQL |
| Leaked secrets | `.env` is git-ignored; app refuses to start without a secret key |
| Cross-site abuse | CORS allow-list; CSRF trusted origins; secure cookies when `DEBUG=0` |
| Bad data | Validation in serializers **and** database constraints |

Known gaps (be honest in interviews): tokens do not expire; there is a single admin role; localStorage holds the token (acceptable for this scope, but a higher-security app would use short-lived tokens or HttpOnly cookies).

---

## 6. How to extend it (practice tasks)

1. **Add a field** (e.g. `guardian_name`): add it to `Student` in `models.py`, run `makemigrations` and `migrate`, add it to `StudentSerializer.Meta.fields`, then add a `field({...})` in the form in `students.js`.
2. **New screen** (e.g. Teachers): a model + serializer + ViewSet + router line on the back-end; an `api` entry, a `views/teachers.js`, and a line in `ROUTES` on the front-end.
3. **Server-side pagination**: use DRF's `PageNumberPagination`, and change `api.students.list` to request one page at a time.
4. **Roles**: add Django groups (teacher, admin) and custom DRF permission classes.
5. **Compile Tailwind** for production with the Tailwind CLI instead of the CDN.

---

## 7. Interview-ready talking points

- "I separated the UI from the data source with an adapter, so the same front-end runs statically on GitHub Pages and against a real API."
- "Validation lives in two places on purpose: serializers for friendly messages, database constraints as the last line of defence."
- "Bulk attendance is atomic and idempotent: saving twice never creates duplicates."
- "I escape all user-supplied text to prevent XSS, and the API is locked by default."
