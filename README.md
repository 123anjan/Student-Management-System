# EduTrack - Student Management System

A full-stack student management system: **students, courses, daily attendance and grades**, with a modern dashboard (dark mode, responsive, accessible).

| Layer | Technology |
|---|---|
| Front-end | HTML5, Tailwind CSS, vanilla JavaScript (ES modules, no build step) |
| Back-end | Python, Django, Django REST Framework (token login) |
| Database | SQLite (development) / MySQL (production) |
| Hosting | Front-end on **GitHub Pages**, back-end on any Python host (e.g. a Hostinger VPS) |

## Two modes, one code base

GitHub Pages can only serve static files, so the front-end has two modes, set in one file (`frontend/assets/js/config.js`):

| `MODE` | Where data lives | Use it for |
|---|---|---|
| `"demo"` | The visitor's browser (localStorage), via a built-in fake server | The live GitHub Pages site. Login accounts:
- `admin` / `admin123` — Principal / Head
- `principal` / `principal123` — Principal / Head
- `registrar` / `registrar123` — Admissions / Registrar
- `teacher` / `teacher123` — Teacher
- `student` / `student123` — Student
- `accountant` / `accountant123` — Accountant
- `librarian` / `librarian123` — Librarian |
| `"live"` | The Django REST API and its database | Real use, local or on your own server |

The screens never know which mode is active; they call `api.js`, which picks the right data source. Read [`docs/UNDERSTANDING.md`](docs/UNDERSTANDING.md) for the full explanation.

## Project structure

```
student-management-system/
├── frontend/                  <- what GitHub Pages publishes
│   ├── index.html             page shell, loads Tailwind + app.js
│   └── assets/
│       ├── css/styles.css
│       └── js/
│           ├── config.js      demo/live switch + API address
│           ├── api.js         the adapter: demo store OR Django
│           ├── demo-store.js  fake backend inside the browser
│           ├── app.js         login, layout, router
│           ├── ui.js, charts.js, icons.js, grading.js, errors.js
│           └── views/         dashboard, students, courses, attendance, grades
├── backend/                   <- Django REST API
│   ├── manage.py, requirements.txt, .env.example
│   ├── config/                settings, urls, wsgi
│   └── students/              models, serializers, views, urls, admin, tests
├── docs/UNDERSTANDING.md      step-by-step explanation of every part
└── .github/workflows/pages.yml  auto-deploy front-end to GitHub Pages
```

## 1. Try the front-end (demo mode)

```bash
cd frontend
python -m http.server 8765        # or: npx serve .
```
Open <http://localhost:8765> and sign in with `admin` / `admin123`.
(ES modules need a web server; double-clicking `index.html` will not work.)

## 2. Run the full stack locally (live mode)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env                 # Windows: copy .env.example .env

python manage.py makemigrations students   # creates the database blueprint
python manage.py migrate                   # builds the tables
python manage.py seed_demo --password "choose-a-strong-password"
python manage.py test                      # run the automated tests
python manage.py runserver                 # API at http://127.0.0.1:8000
```

The backend also serves the front-end, so open <http://127.0.0.1:8000>. Then edit `frontend/assets/js/config.js`:

```js
MODE: "live",
API_BASE_URL: "/api",      // same server -> relative URL, no CORS needed
```

Commit the generated `backend/students/migrations/0001_initial.py` to Git.

## 3. Put the front-end live on GitHub Pages

1. Push this project to your GitHub repository (`main` branch).
2. The workflow in `.github/workflows/pages.yml` enables Pages and publishes `frontend/` on every push.
3. Live site: <https://123anjan.github.io/Student-Management-System/>.

Keep `MODE: "demo"` for this deployment.

## 4. Host the full stack (e.g. Hostinger VPS)

Hostinger documents [installing Django on a VPS](https://www.hostinger.com/tutorials/how-to-install-django) and [deploying a Django app on a VPS](https://www.hostinger.com/in/tutorials/how-to-deploy-django-app/). Check your plan supports Python apps before buying or relying on shared hosting.

1. Upload the project (git clone) to the server and create a virtual environment.
2. `pip install -r requirements.txt`
3. Create `backend/.env` with real values: a new `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=your-domain.com`, `CSRF_TRUSTED_ORIGINS=https://your-domain.com`, and MySQL settings if used.
4. `python manage.py migrate`, `python manage.py collectstatic --noinput`, `python manage.py seed_demo --password "..."`.
5. Run with `gunicorn config.wsgi:application` behind Nginx with HTTPS (a free Let's Encrypt certificate).
6. In `config.js` set `MODE: "live"` and `API_BASE_URL: "/api"`.

**Option B - split hosting:** keep the front-end on GitHub Pages and the API on its own domain. Set `API_BASE_URL: "https://api.your-domain.com/api"` and add `https://<your-username>.github.io` to `CORS_ALLOWED_ORIGINS` in `.env`.

## API reference

All routes except login need the header `Authorization: Token <key>`.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/login/` | `{username, password}` returns `{username, token}` |
| `GET /api/dashboard/` | All dashboard statistics |
| `GET/POST /api/students/` | List (filters `status`, `course`, `q`) / create |
| `GET/PUT/DELETE /api/students/<id>/` | Read / update / delete one student |
| `GET/POST /api/courses/`, `PUT/DELETE /api/courses/<id>/` | Courses |
| `GET /api/attendance/` | Filters `course`, `date`, `student` |
| `POST /api/attendance/bulk/` | Save a class: `{course, date, records:[{student,status}]}` |
| `GET/POST /api/grades/`, `PUT/DELETE /api/grades/<id>/` | Grades |

## Security checklist before real use

- [ ] New random `DJANGO_SECRET_KEY`, and `DJANGO_DEBUG=0`
- [ ] Strong admin password (the demo password `admin123` exists only in demo mode)
- [ ] HTTPS only; `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` set to your real domains
- [ ] `.env` and `db.sqlite3` never committed
- [ ] Regular database backups

## Honest limitations

- Demo mode data is per-browser and not secure; never put real student data in it.
- One admin role only; there are no separate teacher/student logins yet.
- Lists are paginated in the browser, which is fine for hundreds of students. For many thousands, add server-side pagination.
