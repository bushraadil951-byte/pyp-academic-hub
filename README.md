# EPS PYP Academic Hub — Node.js API

Express 4 + Mongoose 8 (MongoDB). Replaces the IBT part of `app.py`. Pairs with `eps-portal-frontend` (React).
Requires Node 18+.

## Run locally

    cp .env.example .env        # set MONGODB_URI and JWT_SECRET
    npm install
    npm run seed -- --sample    # admin + demo teachers/students/test (dev only)
    npm run dev                 # http://localhost:5000

Then in the frontend folder: `npm run dev` (it proxies `/api` to port 5000).

## Move your existing data from Neon (PostgreSQL)

    # .env: DATABASE_URL=<neon string>, MONGODB_URI=<atlas string>
    npm run migrate

Re-runnable. Users keep their current passwords: Flask hashes are accepted and upgraded to bcrypt on next login.
Run it against a copy first and compare counts with the Neon tables.

## Deploy on Render

*One service (simplest):* build the frontend (`npm run build` in `eps-portal-frontend`), put `dist/` next to this folder
and set `FRONTEND_DIST=../eps-portal-frontend/dist`. Build command `npm install`, start command `npm start`.
Env vars: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`. Health check path: `/health` (unchanged).

*Two services:* host the React build as a Static Site; here set `CORS_ORIGIN=https://<your-frontend>` and
`COOKIE_SAMESITE=none`; in the frontend set `VITE_API_URL=https://<this-service>`.

MongoDB Atlas: create a free cluster, add a database user, and allow Render's outbound IPs (or 0.0.0.0/0 while testing).

## Layout

    server.js            start-up
    src/app.js           middleware, route mounting, error handling
    src/models/          User, MockTest (questions embedded), TestResult (unique per student+test),
                         MarkSheet (DT/FA/SA: one document per subject+number+grade+section, marks embedded)
    src/routes/          auth, admin, teacher, student, marks  (matches the frontend README's API contract)
    src/utils/           scoring, Werkzeug-hash verification, helpers
    scripts/             seed.js, migrate-from-postgres.js

## Behaviour changes vs. the Flask app

- Sessions are an httpOnly JWT cookie (12 h) instead of a Flask session. Everyone is signed out at cut-over.
- Login is rate-limited (10 attempts / 15 min / IP).
- Students can only open or submit tests that are active and for their grade (Flask only checked the id).
- The test endpoint never sends correct answers to the browser.
- The seed creates no default `bk*123` admin: set `SEED_ADMIN_PASSWORD` or use the one printed once. Change the
  password of any migrated account that still uses a known default.

## DT, FA and SA

The three assessment types share one model (`MarkSheet`) and one set of routes (`/api/marks/:kind/...`).
`npm run migrate` now also imports `diagnostic_test`/`dt_mark` and `assessment`/`assessment_mark`.
Behaviour notes: a blank mark deletes that student's mark (absent) for FA/SA too, and marks above the maximum are
rejected everywhere (Flask only enforced this for DT). Academic year is `ACADEMIC_YEAR` in `src/config.js`.

## Not ported yet

IB profile / ATL, ISP, Aptitude, admin IBT analytics, bulk student upload, and all PDF/Excel exports.
Those parts of `app.py` still need Node routes (and matching React pages).
