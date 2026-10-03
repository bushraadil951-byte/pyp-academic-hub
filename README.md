# EPS PYP Academic Hub — React frontend

Vite + React 18 + React Router 6 + Recharts. Replaces the Flask/Jinja templates and `static/` folder.
Look and feel is unchanged: `src/index.css` is your old `style.css` plus the inline styles from `base.html`;
`pages/login.css` and `pages/portal.css` are the old login and portal-home styles.

## Run it

    npm install
    npm run dev          # http://localhost:5173, proxies /api -> http://localhost:5000

Production build: `npm run build` (outputs `dist/`). Set `VITE_API_URL` to your Node API's URL when the
API is hosted separately (e.g. two Render services); leave it empty if Express serves `dist/` itself.

## What's ported (IBT module)

| Flask route | React route |
|---|---|
| `/` login | `/` |
| `/portal` | `/portal` |
| `/admin`, `/admin/students`, `/admin/teachers`, `/admin/tests`, `/admin/tests/<id>/questions` | same paths |
| `/teacher`, `/teacher/students` | same paths |
| `/student`, `/student/test/<id>`, `/student/scores`, `/student/review/<id>` | same paths |

## Also ported: DT, FA and SA (marks module)

| Flask route | React route |
|---|---|
| `/assessment/hub` | `/marks` |
| `/admin/dt-dashboard`, `/assessment/<FA|SA>/dashboard` | `/marks/DT`, `/marks/FA`, `/marks/SA` |
| `/admin/dt`, `/assessment/<atype>/entry` | `/marks/:kind/entry` |
| `/admin/dt/upload`, `/assessment/<atype>/upload` (+ template) | `/marks/:kind/upload` (CSV is parsed in the browser) |
| `/admin/dt/grade-analytics`, `/admin/dt/analytics`, `/assessment/<atype>/grade-analytics` | `/marks/:kind/analytics` |
| `/admin/dt/cross-grade-analytics`, `/assessment/<atype>/cross-grade-analytics` | `/marks/:kind/cross-grade` (admin only) |
| `/student/diagnostics` | `/student/progress/DT` |

Not ported yet (portal tiles open a "not ported yet" page): IB profile / ATL, ISP, Aptitude, admin IBT analytics,
bulk student upload, and every PDF/Excel export (DT PDF reports and graphs, results downloads).

## API contract the Node/Express backend must provide

All routes are JSON under `/api`, authenticated by an httpOnly session cookie (CORS: `credentials: true`).
Errors: HTTP 4xx with `{ "error": "message" }`. Roles are `Resource_Manager`, `teacher`, `student`.

| Method + path | Body / response |
|---|---|
| `POST /auth/login` | `{username,password}` → `{user:{id,name,role,grade}}` |
| `GET /auth/me`, `POST /auth/logout` | `{user}` / `{}` |
| `GET /admin/dashboard` | `{studentCount,activeTests,avgScore,submitted,byGrade:[{grade,avg}],bySubject:[{subject,avg}],recent:[{id,student,test,subject,percent,takenAt}]}` |
| `GET/POST /admin/students`, `PUT/DELETE /admin/students/:id` | student `{id,name,username,grade,section,password?}` |
| `GET/POST /admin/teachers`, `PUT/DELETE /admin/teachers/:id` | teacher `{id,name,username,grade,password?}` |
| `GET/POST /admin/tests`, `PUT/DELETE /admin/tests/:id`, `POST /admin/tests/:id/toggle`, `POST /admin/tests/:id/recalculate` | test `{id,name,subject,grade,difficulty,duration,status,questionCount}` |
| `GET/POST /admin/tests/:id/questions`, `PUT/DELETE /admin/tests/:id/questions/:qid` | GET → `{test,questions:[{id,section,passage,question,options[4],answer,image}]}` |
| `GET /teacher/dashboard` | `{grade,studentCount,activeTests,avgScore,submitted,recent:[{id,student,test,percent,takenAt}]}` |
| `GET /teacher/students` | `[{id,name,grade,section,testsTaken,avg}]` |
| `GET /student/dashboard` | `{student,tests:[{id,name,subject,difficulty,duration}],completedTestIds,avg,results:[{id,test,percent,takenAt}]}` |
| `GET /student/tests/:id` | `{test:{id,name,duration},questions}` — **omit `answer`** from questions here |
| `POST /student/tests/:id/submit` | `{answers:{qid:optionIndex},time_taken}` → `{score,total,percent,section_scores}` |
| `GET /student/scores` | `[{id,test,subject,score,total,percent,takenAt}]` |
| `GET /student/results/:id` | `{test,result,review:[{question,given,correct,status}]}` |

Marks module (`:kind` is `dt`, `fa` or `sa`; staff = teacher or admin, teachers are locked to their grade):

| Method + path | Notes |
|---|---|
| `GET /marks/config` (staff) | `{academicYear,kinds,grades,gradeLocked,sections,isAdmin}` |
| `GET /marks/hub` (staff) | `[{kind,label,totalSheets,totalMarks}]` |
| `GET /marks/:kind/dashboard` (staff) | totals and per-grade student counts |
| `GET/PUT /marks/:kind/entry` (staff) | GET `?grade&section&subject&number` → `{students,sheet,marks}`; PUT `{grade,section,subject,number,maxMarks,testDate,rows:[{studentId,marks,remarks}]}` → `{saved,removed,invalid}` |
| `PUT /marks/:kind/bulk` (staff) | `{grade,section,number,maxMarks:{subject:n},rows:[{username,marks:{subject:value}}]}` |
| `GET /marks/:kind/analytics` (staff) | `?grade&section` → students, classAvg, subjectOverall, classOverall |
| `GET /marks/:kind/cross-grade` (admin) | per-grade subject averages |
| `GET /marks/student-progress/:kind` (student) | own series and insights |

Server-side rules carried over from `app.py`: one attempt per student per test (return the existing result if
re-submitted); teachers only see students in their assigned grade; students only see their own results.
