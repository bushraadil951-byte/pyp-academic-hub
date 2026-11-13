# Deploying to a VPS: step by step

This guide puts the PYP Academic Hub on an Ubuntu VPS at **https://portal.e-p-s.in**.
The app is one Node.js process: it serves the website and the API (`/api/*`) on port 5000.
nginx sits in front of it to handle the domain and HTTPS, and PM2 keeps it running.

    Browser ──HTTPS──▶ nginx (ports 80/443) ──▶ Node app (127.0.0.1:5000) ──▶ MongoDB Atlas

Commands are for **Ubuntu 22.04 or 24.04**, and every command on the server runs as **root**.
The app lives in **`/var/www/pyp-academic-hub`** on the server. Commands marked "on your computer" do not run on the VPS.

**Already part way through?** You can safely repeat any step. Steps 5 to 8 say what to do if that step is already done.

---

## What you need before you start

| Item | Details |
|---|---|
| A VPS | Ubuntu 22.04/24.04, at least 1 GB RAM, with its public IP address and root login |
| The domain | Access to the DNS settings of `e-p-s.in` |
| MongoDB Atlas | The cluster connection string (database `pyp-school-hub`) and access to the Atlas dashboard |
| The code | Pushed to GitHub, with access to the repository (it is private, so you need a deploy key: step 5) |
| The old app's database | A connection string for the old database, if the old app is still in use (see "Moving the live data") |
| Email (optional) | A Brevo or Resend API key, for "your password was changed" notices |

---

## Order of work

If the old app is still in use, keep it running while you set up the VPS, so users are not interrupted:

1. Do steps 2 to 8 now. Skip step 1 for the moment and test on the server with the `curl` check in step 7.
2. Choose a quiet time and do **Moving the live data** (below step 10) to copy the latest data across.
3. Do step 1 (DNS), step 9 (HTTPS) and step 10 (checks).

If nobody is using the old app, or `portal.e-p-s.in` is not live yet, you can follow the steps in order.

---

## Step 1: Point the domain at the server

In your domain's DNS settings (wherever `e-p-s.in` is managed), add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `portal` | `<VPS public IP>` | Auto / 300 |

Check it from your computer (it can take a few minutes to an hour):

```bash
dig +short portal.e-p-s.in
```

It should print the VPS IP address. Continue with the next steps while you wait.

---

## Step 2: Allow the server in MongoDB Atlas

1. Open https://cloud.mongodb.com and select the project with the `eps-school` cluster.
2. Go to **Security → Network Access → Add IP Address**.
3. Enter the VPS public IP address, add a comment such as `portal VPS`, and click **Confirm**.

Without this, the app cannot connect to the database (`MongooseServerSelectionError`).

---

## Step 3: Log in and prepare the server

From your computer:

```bash
ssh root@<VPS public IP>
```

On the server, update packages and install the basics:

```bash
apt update && apt upgrade -y
apt install -y git curl nginx ufw
```

Turn on the firewall, allowing only SSH and web traffic (port 5000 stays private):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## Step 4: Install Node.js 22 and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
npm install -g pm2
```

`node -v` should print `v22.x`, the Node version the app already runs on.

---

## Step 5: Get the code onto the server

**If the repo is already cloned**, update it and skip the rest of this step:

```bash
cd /var/www/pyp-academic-hub
git pull
ls package.json DEPLOY.md deploy/nginx.conf
```

All three files must be listed. If `git pull` asks for a password, set up the deploy key below, then run
`git remote set-url origin git@github.com:eps-website-admin/pyp-academic-hub.git` and try again.

**If it is not cloned yet:** the repository is private, so give the server read-only access with a **deploy key**:

```bash
ssh-keygen -t ed25519 -C "portal-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the printed line. On GitHub, open the repository → **Settings → Deploy keys → Add deploy key**,
paste it, leave "Allow write access" **unticked**, and save. Then clone:

```bash
ssh -o StrictHostKeyChecking=accept-new -T git@github.com
git clone git@github.com:eps-website-admin/pyp-academic-hub.git /var/www/pyp-academic-hub
cd /var/www/pyp-academic-hub
```

(The first command prints "You've successfully authenticated"; that is expected.)

---

## Step 6: Create the settings file (environment variables)

**If `eps-portal-backend/.env` already exists**, check it and go to step 7:

```bash
cd /var/www/pyp-academic-hub
grep -c = eps-portal-backend/.env
```

With email set up it prints `6`.

**If it does not exist**, replace the three `<...>` values below, then paste the whole block. It generates a new
`JWT_SECRET` by itself. Keep real passwords and keys only in this file on the server: never put them in this guide or in git.

```bash
cd /var/www/pyp-academic-hub
cat > eps-portal-backend/.env <<EOF
PORT=5000
MONGODB_URI=mongodb+srv://<db user>:<db password>@eps-school.lqurmei.mongodb.net/pyp-school-hub
JWT_SECRET=$(openssl rand -hex 32)
BREVO_API_KEY=<your Brevo API key>
MAIL_FROM_EMAIL=<a sender address verified in Brevo>
MAIL_FROM_NAME="Eastern Public School"
EOF
chmod 600 eps-portal-backend/.env
```

Do not copy `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_DIST` or `NODE_VERSION` from the old hosting setup.
If the password contains `@`, `:`, `/` or `$`, change it to one without those characters.

All environment variables the app understands:

| Variable | Required | What it does |
|---|---|---|
| `MONGODB_URI` | **Yes** | Atlas connection string, ending in the database name `/pyp-school-hub` |
| `JWT_SECRET` | **Yes** | Long random secret that signs login sessions. The app will not start in production without it. Changing it signs everyone out. |
| `PORT` | No (default `5000`) | Port the app listens on. Must match `proxy_pass` in the nginx file. |
| `NODE_ENV` | Set by PM2 | `production`. Do not put it in `.env`; `ecosystem.config.cjs` already sets it. |
| `BREVO_API_KEY` or `RESEND_API_KEY` | No | Email service for "your password was changed" notices. Without one, none are sent. |
| `MAIL_FROM_EMAIL` | For email | Sender address verified with that email service |
| `MAIL_FROM_NAME` | No | Sender name (default `Eastern Public School`) |
| `MAIL_PROVIDER` | No | Force `brevo` or `resend` if both keys are set |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google sign-in | From Google Cloud: see [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md). The Google button appears once both are set. |
| `GOOGLE_ALLOWED_DOMAIN` | No (default `e-p-s.in`) | Only addresses in this domain can sign in with Google or be added by an admin |
| `APP_URL` | No (default `https://portal.e-p-s.in`) | The address people open the app on. Must match the redirect URI set up with Google. |
| `COOKIE_SECURE` | No | Set `false` **only** to test over plain `http://` before HTTPS works (step 9). Remove it afterwards. |
| `CORS_ORIGIN`, `COOKIE_SAMESITE` | No | Only for hosting the website on a different domain from the API. Not needed here. |
| `FRONTEND_DIST` | No | Location of the built website. The default is correct. |

The frontend needs **no** environment variables: it calls the API on the same domain.

---

## Step 7: Build and start the app

```bash
cd /var/www/pyp-academic-hub
npm run build
pm2 startOrRestart ecosystem.config.cjs
pm2 logs pyp-academic-hub --lines 20 --nostream
curl http://127.0.0.1:5000/health
```

`npm run build` installs the dependencies locked in `package-lock.json` and builds the website into
`eps-portal-frontend/dist`. It takes a minute or two and ends with `✓ built in ...`.

The logs should show `MongoDB connected` and `EPS Portal API listening on :5000`, and the last command should print `OK`.

Make PM2 start the app again after a reboot:

```bash
pm2 save
pm2 startup
```

Run `pm2 save` again whenever you add or remove an app in PM2.

---

## Step 8: Set up nginx

```bash
cp /var/www/pyp-academic-hub/deploy/nginx.conf /etc/nginx/sites-available/pyp-academic-hub
ln -sf /etc/nginx/sites-available/pyp-academic-hub /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

`nginx -t` must say `syntax is ok` and `test is successful`. The file is already set up for `portal.e-p-s.in`
and forwards everything to the app on `127.0.0.1:5000`. These commands are safe to run again, but if certbot has
already added HTTPS (step 9), do not copy the file again: that removes the HTTPS settings.

Check that nginx reaches the app:

```bash
curl -H "Host: portal.e-p-s.in" http://127.0.0.1/health
```

It should print `OK`. `502 Bad Gateway` means the app is not running: go back to step 7.

---

## Step 9: Turn on HTTPS

Check that the domain points at this server:

```bash
getent hosts portal.e-p-s.in
curl -4 -s ifconfig.me; echo
```

Both must show the same IP address. Wait if they do not (step 1). Then:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d portal.e-p-s.in
```

Enter an email for expiry notices and agree to the terms. Certbot adds HTTPS to the nginx file, redirects
`http://` to `https://`, and renews the certificate automatically. Check renewal works:

```bash
certbot renew --dry-run
```

**HTTPS is required for login**: in production the login cookie is only sent over HTTPS.

---

## Step 10: Check everything

Open **https://portal.e-p-s.in**: the sign-in page should load with a padlock in the address bar.

| Check | Expected |
|---|---|
| https://portal.e-p-s.in/health | `OK` |
| https://portal.e-p-s.in | Sign-in page |
| http://portal.e-p-s.in | Redirects to https |
| Sign in with an admin account | Admin dashboard (see "Signing in" below) |

Then, before real users start:

1. **Remove the test account:** delete `test_admin` from the admin screens, if it still exists.
2. **Change exposed credentials:** change the database password in Atlas and the Brevo key, update them in
   `eps-portal-backend/.env`, and run `pm2 restart pyp-academic-hub`.
3. **Revoke old GitHub tokens** that were saved in files or git remote URLs.

---

## Moving the live data

The database dump was taken before the move, so anything entered in the old app since then is missing from
`pyp-school-hub`. This final sync copies the latest data across. Users cannot use the app while you do it.

**Warning:** `--drop` replaces the collections in `pyp-school-hub` with the old data. Anything created there since
the first import is removed, including the `test_admin` account. Double-check both connection strings first.

1. **Stop the old app** in its hosting dashboard, so nothing changes during the copy. Note how to start it again.
2. **On your computer**, install the MongoDB Database Tools (https://www.mongodb.com/try/download/database-tools)
   and allow your IP address under **Network Access** on both Atlas clusters. Run steps 3 to 5 there.
3. **Make a safety backup** of the new database:

   ```bash
   mongodump --uri="mongodb+srv://<db user>:<db password>@eps-school.lqurmei.mongodb.net/pyp-school-hub" --gzip --archive=before-cutover.gz
   ```

4. **Dump the old database.** Its data is in the database named `test`:

   ```bash
   mongodump --uri="<old MONGODB_URI>" --db=test --gzip --archive=final.gz
   ```

5. **Restore it into `pyp-school-hub`:**

   ```bash
   mongorestore --uri="mongodb+srv://<db user>:<db password>@eps-school.lqurmei.mongodb.net/" --gzip --archive=final.gz --nsFrom='test.*' --nsTo='pyp-school-hub.*' --drop
   ```

   The last line of the output should say `0 document(s) failed to restore`.

6. **On the VPS**, restart the app:

   ```bash
   pm2 restart pyp-academic-hub
   ```

7. **Finish:** do step 1 (DNS), step 9 (HTTPS) and step 10 (checks), then sign in.

Keep the old app stopped from now on, so nobody enters data in the old system by mistake. If something goes wrong
before DNS is switched, start the old app again: users carry on there and nothing is lost. Once everything works,
change the old database password.

---

## Signing in

People sign in with their **school email**, either with Google or with a password. To add Google sign-in,
follow [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md).

- **Adding people:** when an admin adds a teacher or student, the app shows a temporary password once. A bulk
  student CSV import downloads them as a file instead. The first sign-in with it asks the person to choose their own.
- **Forgotten passwords:** there is no "Forgot password" link. The person asks an admin, who clicks
  **Reset password** next to their name for a new temporary password. Teachers can do this for students in their grade.
- **Imported users** keep their passwords, but can sign in only once their school email is added:
  **Students → Import emails**. Do that before telling people to use the new portal.

**The first admin:** the imported admins (**`AcademicAdmin`**, **`Organizer`**) have no email yet, so first give one
an email and a temporary password. In `/var/www/pyp-academic-hub`:

```bash
npm run reset-password -w eps-portal-backend -- Organizer <your address>@e-p-s.in
```

It prints a one-time temporary password. Sign in with that email and password, and the app asks you to choose a new
password (8+ characters with at least one letter and one number). Then import everyone else's email from the app.
The same command, with an email that is already on the account, gets you back in if an admin password is lost:

```bash
npm run reset-password -w eps-portal-backend -- <admin address>@e-p-s.in
```

If the database is empty (a fresh install with no imported data), create the first admin instead:

```bash
SEED_ADMIN_EMAIL='<your address>@e-p-s.in' SEED_ADMIN_PASSWORD='<choose a strong password>' npm run seed -w eps-portal-backend
```

---

## Updating to a new version

```bash
cd /var/www/pyp-academic-hub
git pull
npm run build
pm2 restart pyp-academic-hub
```

Users stay signed in across updates, as long as `JWT_SECRET` does not change.

---

## Everyday commands

| Task | Command |
|---|---|
| Is it running? | `pm2 status` |
| Live logs | `pm2 logs pyp-academic-hub` |
| Last 100 log lines | `pm2 logs pyp-academic-hub --lines 100 --nostream` |
| Restart | `pm2 restart pyp-academic-hub` |
| Stop | `pm2 stop pyp-academic-hub` |
| After editing `.env` | `pm2 restart pyp-academic-hub` |
| CPU and memory | `pm2 monit` |

nginx: `nginx -t && systemctl reload nginx`, logs in `/var/log/nginx/error.log` and `/var/log/nginx/access.log`.

---

## Backups

Atlas paid tiers take automatic backups (Atlas → **Backup**). On the free tier, take one yourself with the
[MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools):

```bash
mongodump --uri="mongodb+srv://<db user>:<db password>@eps-school.lqurmei.mongodb.net/pyp-school-hub" --gzip --archive=backup-$(date +%F).gz
```

Restore into the same database with:

```bash
mongorestore --uri="mongodb+srv://<db user>:<db password>@eps-school.lqurmei.mongodb.net/" --gzip --archive=backup-YYYY-MM-DD.gz --drop
```

`--drop` replaces the current collections with the backup. Leave it out to only add missing documents.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `502 Bad Gateway` | The app is not running. `pm2 status`, then `pm2 logs pyp-academic-hub` for the error. |
| `MongooseServerSelectionError` in the logs | VPS IP missing in Atlas **Network Access** (step 2), or a wrong `MONGODB_URI`. |
| `JWT_SECRET must be set` in the logs | `JWT_SECRET` missing from `.env`, or still `change-me` (step 6). |
| Sign-in "works" but you land back on the sign-in page | Site opened over `http://`. Finish step 9 and use `https://`. |
| `Too many sign-in attempts` | 10 failed attempts in 15 minutes from one IP. Wait 15 minutes. |
| `cp: cannot stat ...` or `No such file` | Check the path is exactly `/var/www/pyp-academic-hub`, and run `git pull` there. |
| `E11000 duplicate key` on `email` at start-up | Two accounts share an address. Addresses must now be unique: change one of them. |
| Changes not showing after an update | Run `npm run build` before `pm2 restart`, then hard-refresh the browser. |
| Certbot fails | DNS not pointing at the VPS yet (`dig +short portal.e-p-s.in`), or ports 80/443 blocked (`ufw status`). |
| `413 Request Entity Too Large` on question images | Images are limited to 2 MB each; nginx allows 5 MB per request. |
| "Password changed" emails never arrive | Check `BREVO_API_KEY`/`MAIL_FROM_EMAIL`, that the sender is verified in Brevo, and `pm2 logs` for `[mail]` lines. |
