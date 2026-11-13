# Google sign-in: what is needed and where to get it

This guide lists what has to be set up outside the code for "Sign in with Google" on https://portal.e-p-s.in.
It takes about 20 minutes. Google sometimes renames its menus, so a label may differ slightly from what is shown here.

The Google button appears on the sign-in page as soon as the values from step 6 are in place.

## What you will end up with

| Item | Looks like | Secret? |
|---|---|---|
| Client ID | `123456-abc.apps.googleusercontent.com` | No |
| Client secret | `GOCSPX-...` | **Yes**: never send it by chat or email, or put it in git |
| List of who may sign in | Each person's `@e-p-s.in` address | Personal data: keep it private |

---

## Step 1: Sign in with website@e-p-s.in

You do not need the Google Workspace owner for this setup. Use the `website@e-p-s.in` account for steps 2 to 5.
Keep this account's password safe: whoever controls it controls the Google sign-in settings.

Anyone signing in to the portal needs a working `@e-p-s.in` Google account. Only the Workspace owner can create those.

## Step 2: Create a Google Cloud project

1. Open https://console.cloud.google.com, signed in as `website@e-p-s.in`. Accept the terms if asked.
2. Open the project selector at the top, then click **New project**.
3. Name it `EPS Portal`. Leave **Organization** and **Location** as they are.
4. Click **Create**, then select the new project.

If creating a project is blocked, the Workspace owner has turned this off. In that case, they need to allow it for this account.

## Step 3: Set up the sign-in screen

1. Open https://console.cloud.google.com/auth/overview and click **Get started**.
2. Fill in:
   - **App name:** `EPS PYP Academic Hub`
   - **User support email:** `website@e-p-s.in`
   - **Audience:** choose **Internal** if it is offered. If not, choose **External**.
   - **Contact email:** `website@e-p-s.in`
3. Agree to the policy and click **Create**.
4. **Only if you chose External:** open **Audience** and click **Publish app**, then confirm. Otherwise only listed test users can sign in.
   This app reads only name and email, so Google does not need to review it.

Either option is safe, because the portal itself rejects any address outside `@e-p-s.in`, and any address an admin has not added.

## Step 4: Choose what the app can read

1. Open **Data Access** (https://console.cloud.google.com/auth/scopes).
2. Click **Add or remove scopes**, tick `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
3. Click **Update**, then **Save**.

The app only sees a person's name and email address. It cannot read their mail or files.

## Step 5: Create the client ID and secret

1. Open **Clients** (https://console.cloud.google.com/auth/clients) and click **Create client**.
2. **Application type:** Web application. **Name:** `EPS Portal website`.
3. Under **Authorized JavaScript origins**, add:

       https://portal.e-p-s.in
       http://localhost:5173

4. Under **Authorized redirect URIs**, add:

       https://portal.e-p-s.in/api/auth/google/callback
       http://localhost:5173/api/auth/google/callback

5. Click **Create**, and copy the **Client ID** and **Client secret** straight away. Google may not show the secret again.

## Step 6: Store the values

Do not paste the values into chat. Add these lines to `eps-portal-backend/.env`, on your Mac and on the VPS:

    GOOGLE_CLIENT_ID=<your client ID>
    GOOGLE_CLIENT_SECRET=<your client secret>
    GOOGLE_ALLOWED_DOMAIN=e-p-s.in

Your Mac also needs this line, because the app runs on a different address there:

    APP_URL=http://localhost:5173

On the VPS, leave `APP_URL` out: it defaults to https://portal.e-p-s.in. Run `pm2 restart pyp-academic-hub` afterwards.
`.env` is not in git, so the secret stays private.

## Step 7: Add everyone's @e-p-s.in address

People sign in with their exact `@e-p-s.in` address, with Google or with a password. Today only 1 of the 274
accounts has one, so the others cannot sign in until theirs is added. Their passwords stay the same.

There are two ways to add them, and you can use both:

- **CSV:** sign in as an admin and open **Students → Import emails**. Download the template, which already lists every
  admin, teacher and student. Fill in the **email** column, save it as CSV and upload it. The template's `username`
  column only tells the app which row is which person: leave it as it is.
- **In the app:** an admin types the address when adding or editing a person.

Each address must end in `@e-p-s.in` and can belong to only one person. The import lists anything it skipped.

The CSV looks like this (these are examples, not real people):

    username,email
    student_one,student.one@e-p-s.in
    teacher_one,teacher.one@e-p-s.in

## Step 8: Test before telling everyone

1. Sign in with Google as a few people from each role: an admin, a teacher and a student.
2. Add a test student, and sign in with their email and the temporary password shown. The app should ask for a new password.
3. Reset that student's password from **Students**, and check the new temporary password works the same way.

## When you are done

Tell the developer:

- [ ] Steps 1 to 5: the client is created, and the audience is Internal or published External
- [ ] Step 6: the lines are in `.env` on the Mac and on the VPS
- [ ] Step 7: every student, teacher and admin has an address
- [ ] Step 8: Google and password sign-in both work

## Troubleshooting

| Problem | Fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | The address in step 5 must match exactly, including `https` and with no extra `/` at the end. |
| `Error 403: org_internal` | The account is outside the e-p-s.in organization. Use a school account. |
| "Your account has not been added yet" | The person's address is missing from the portal, or is typed differently from their Google address. |
| "Invalid email or password" | Check the address is on their account (step 7). A forgotten password needs an admin to click **Reset password**. |
| "Please use your school Google account" | They chose a personal Google account. Sign out of it, or choose the school one. |
| Students are blocked by Google, but staff are not | The Workspace owner has restricted third-party apps for under-18 users, and needs to allow this app. |
| `Error 403: access_denied` | The app is still in testing. Open **Audience** and click **Publish app**. |
| Secret was lost | In **Clients**, open the client, add a new secret, and update `.env`. |
| A secret was shared by mistake | Add a new secret, update `.env`, and delete the old one in **Clients**. |
