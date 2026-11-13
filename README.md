# pyp-academic-hub

EPS PYP Academic Hub. `eps-portal-frontend` (React + Vite) is built into static files that `eps-portal-backend`
(Express + MongoDB) serves, so the app runs as a single Node service on one port: `/api/*` is the API,
`/health` is the health check, and every other path is the React app.

Both folders are npm workspaces: run `npm install` / `npm ci` once at the repo root (one `package-lock.json`,
one `node_modules`). Add a package to one side with e.g. `npm install express-foo -w eps-portal-backend`.

    eps-portal-backend/    Express API; also serves eps-portal-frontend/dist
    eps-portal-frontend/   React + Vite source
    deploy/nginx.conf      reverse proxy for the VPS
    ecosystem.config.cjs   PM2 process file

## Run locally (step by step)

### 1. Install the tools

- **Node.js 22 or newer** from https://nodejs.org (check with `node -v`).
- **Git**, to clone the repo.
- **A MongoDB database**, either:
  - **MongoDB Atlas** (cloud): use a database name of your own for development, e.g. `pyp-school-hub-dev`,
    so local testing never changes live data. In Atlas, add your current IP under *Network Access*; or
  - **MongoDB Community Server** installed on your machine: https://www.mongodb.com/try/download/community
    (connection string `mongodb://localhost:27017/pyp-school-hub-dev`).

### 2. Get the code and install dependencies

    git clone <repo-url> pyp-academic-hub
    cd pyp-academic-hub
    npm install        # installs backend and frontend in one go (npm workspaces)

### 3. Create the settings file

    cp eps-portal-backend/.env.example eps-portal-backend/.env

Open `eps-portal-backend/.env` and set:

- `MONGODB_URI`: your development database from step 1.
- `JWT_SECRET`: any long random text, e.g. the output of `openssl rand -hex 32`.

Leave `NODE_ENV` unset locally: in production mode, login cookies only work over HTTPS.

### 4. Put some data in the database

Pick one:

- **Copy real data** from a mongodump archive (`mongorestore` comes with the
  [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)). Existing users keep their passwords:

      mongorestore --uri="<your MONGODB_URI without the database name>" --gzip --archive=mydb.gz \
        --nsFrom='test.*' --nsTo='pyp-school-hub-dev.*'

- **Use existing accounts:** people sign in with their school email. If you restored real data, the admins
  (`AcademicAdmin`, `Organizer`) have no email yet. Give one an email and a temporary password (you are asked for a
  new password at sign-in):

      npm run reset-password -w eps-portal-backend -- AcademicAdmin you@e-p-s.in

- **Start empty with demo accounts:**

      npm run seed -w eps-portal-backend -- --sample

  This prints an admin login (`admin@e-p-s.in` / a random password, shown once: save it) and adds demo teachers
  (`teacher1@e-p-s.in`, `teacher2@e-p-s.in`) and students (`aarav@`, `priya@`, `rohan@`, `sneha@e-p-s.in`), all with
  password `demo1234`.

### 5. Start the app

**For development (hot reload)**, use two terminals at the repo root:

    npm run dev:api    # terminal 1: API on http://localhost:5000
    npm run dev:web    # terminal 2: open http://localhost:5173

Edits to the frontend show up instantly; the API restarts by itself when a backend file changes.
Vite forwards `/api` calls from port 5173 to the API on 5000.

**Exactly as in production (one service)**:

    npm run build      # builds the frontend into eps-portal-frontend/dist
    npm start          # open http://localhost:5000

Here the API and the website share port 5000. Re-run `npm run build` after changing frontend code.

### 6. Check it works

- http://localhost:5000/health shows `OK`.
- Sign in with one of the accounts from step 4.

### Troubleshooting

- **`MongooseServerSelectionError` / cannot connect**: check `MONGODB_URI`, and that your IP is allowed in Atlas
  *Network Access* (or that local MongoDB is running).
- **Login succeeds but you are sent back to the login page**: `NODE_ENV=production` is set without HTTPS.
  Remove it from `.env` (or add `COOKIE_SECURE=false`).
- **`EADDRINUSE: port 5000`**: another program uses the port (on macOS often AirPlay Receiver). Set `PORT=5001`
  in `.env`, and for `dev:web` start Vite with `VITE_API_TARGET=http://localhost:5001 npm run dev:web`.
- **Blank page at http://localhost:5000**: the frontend is not built yet; run `npm run build`.

## Signing in

People sign in with their school email, either with Google or with a password. Only `@e-p-s.in` accounts that an
admin has already added can sign in. There is no registration and no "Forgot password" link:

- When an admin adds someone, the app shows a temporary password once. A bulk CSV import downloads them as a file.
- The first sign-in with a temporary password asks the person to choose their own.
- Someone who forgets their password asks an admin, who clicks **Reset password** for a new temporary one.

Google setup is in **[GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md)**.

## Deploy on a VPS

See **[DEPLOY.md](DEPLOY.md)** for the full step-by-step guide (DNS, Atlas, Node, PM2, nginx, HTTPS,
environment variables, updates, backups and troubleshooting) for https://portal.e-p-s.in.

Quick update once deployed:

    git pull && npm run build && pm2 restart pyp-academic-hub
