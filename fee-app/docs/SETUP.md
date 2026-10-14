# First-time setup

Done once, by whoever administers the school's Google account. About 20 minutes.

At the end you will have: a spreadsheet that holds the fee records, a service
account that is the only thing allowed to write to it, a deployed app, and one
administrator login.

---

## 1. Create the spreadsheet

1. Sign in to the Google account that should **own** the fee data. This account
   is the ultimate owner of the records, so use a school account, not a personal
   one, and make sure 2-step verification is on.
2. Create a new spreadsheet and name it something like
   `SNS Fee Register (live data)`.
3. Copy its id from the address bar — the long part between `/d/` and `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEf...XyZ/edit
                                          ^^^^^^^^^^^^^^ this
   ```

Leave it empty. Step 4 creates the tabs.

## 2. Create the service account

A service account is a non-human Google identity. The app signs in as this
account, so no member of staff needs a Google account and nobody has to share a
personal password with the app.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) with the
   same Google account.
2. Create a new project — call it `sns-fee-register`. Keeping it in its own
   project means the credential below cannot reach anything else.
3. In **APIs & Services → Library**, search for **Google Sheets API** and enable
   it. Enable nothing else.
4. In **APIs & Services → Credentials**, choose **Create credentials → Service
   account**:
   - Name: `fee-app`
   - Grant it no project roles (it does not need any; access comes from sharing
     the spreadsheet with it in step 3)
5. Open the new service account, go to **Keys → Add key → Create new key →
   JSON**, and download the file.

That JSON file is a password. Do not put it in the repository, do not email it,
and delete it from your Downloads folder once step 5 is done.

From the file you need two values:

- `client_email` — looks like `fee-app@sns-fee-register.iam.gserviceaccount.com`
- `private_key` — a long block starting `-----BEGIN PRIVATE KEY-----`

## 3. Share the spreadsheet with the service account

Open the spreadsheet, click **Share**, paste the `client_email` value, and give
it **Editor**. Turn off "Notify people".

This is what grants access. The service account can now reach this one
spreadsheet and nothing else in the school's Drive.

Keep the spreadsheet's own sharing restricted — never "anyone with the link".

## 4. Create the tabs and the first administrator

On a computer with the repository checked out and Node 20 or newer installed:

```bash
cd fee-app
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in four values:

```ini
GOOGLE_SERVICE_ACCOUNT_EMAIL=fee-app@sns-fee-register.iam.gserviceaccount.com

# The private_key from the JSON file, on ONE line, with the line breaks written
# as \n, wrapped in double quotes. Copying it straight out of the JSON file
# already gives you this form.
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"

FEES_SHEET_ID=1AbCdEf...XyZ

# Generate with: openssl rand -base64 48
SESSION_SECRET=paste-48-random-bytes-here
```

Then:

```bash
npm run bootstrap-sheet -- --admin-username rahul --admin-name "Rahul Pal"
```

It creates the five tabs (`Users`, `Students`, `Payments`, `FeeStructure`,
`AuditLog`) with their header rows frozen and protected, then creates the first
administrator and prints a temporary password:

```
--------------------------------------------------------------
  FIRST ADMIN - hand these over in person, then delete them.
  Username:           rahul
  Temporary password: ka7Rmv3xQtbz
  They will be required to set a new password at first sign-in.
  This password is not stored anywhere and cannot be shown again.
--------------------------------------------------------------
```

That password is not recorded anywhere. If it is lost, run the script again
after setting `active` to `FALSE` on the user's row.

The script is safe to re-run: it skips tabs, columns and admins that already
exist. `npm run bootstrap-sheet -- --check` reports problems without changing
anything.

## 5. Deploy

The fee app is a **second Vercel project** on the same repository, with its root
directory set to `fee-app`. The public website's project is not touched.

1. At [vercel.com](https://vercel.com/new), import `rahpal/snshikshaniketan`
   again as a new project. Name it something like `sns-fee-register`.
2. Set **Root Directory** to `fee-app`. Framework preset: Vite. Leave the build
   command and output directory as the defaults — `fee-app/vercel.json` sets
   them.
3. Under **Settings → Environment Variables**, add the same four values from
   `.env.local` to **Production** and **Preview**:
   `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `FEES_SHEET_ID`,
   `SESSION_SECRET`.

   For `GOOGLE_PRIVATE_KEY`, paste the one-line `\n` form. Do not add surrounding
   quotes in the Vercel field.
4. Under **Settings → Git → Ignored Build Step**, use:

   ```bash
   git diff --quiet HEAD^ HEAD -- fee-app/
   ```

   This stops the fee app rebuilding when only the public website changed.
5. Deploy, then under **Settings → Domains** add `fees.snshikshaniketan.com` and
   create the CNAME record Vercel shows you. Until then, the `*.vercel.app` URL
   works.

Sign in as the administrator from step 4. You will be asked to set your own
password immediately. The dashboard then shows a green "Connected to the fee
spreadsheet" panel; if it is amber, it names what is wrong.

## 6. Load the student list

Sign in as the administrator and open **Students**. Choose a CSV file with a
row per student and these columns — the headings can be written however your
existing list writes them (`Student Name`, `Name`, `Father's Name`, `Mobile`
and similar are all recognised):

```csv
Student Name,Class,Parent Name,Contact
Arjun Verma,5,Rakesh Verma,9876543210
Kabir Khan,NUR,Imran Khan,9876500000
```

Class must be one of `NUR`, `KG`, `1`…`8`. The screen shows what will be
imported, what is already there, and which rows it cannot read, before anything
is written. Importing the same file twice adds nothing, so a half-finished
import can simply be run again.

If no list exists yet, skip this: recording a payment for a student who is not
on the list adds them automatically.

## 7. Add the rest of the staff

Open **Users** and choose **Add a user**. Give the office **Data entry**, not
Administrator: data entry can see everything and record payments, but cannot
change an entry after the fact, which is the point of the two roles.

The screen shows a temporary password once. Hand it over in person and close
the box — it is not stored anywhere in readable form and cannot be shown again.
They will be made to choose their own password at first sign-in. If it is lost,
use **Reset password**, which also clears a lockout and signs that person out
everywhere.

Some things the screen will not let you do, on purpose: you cannot switch off
or demote your own account, and you cannot remove the last administrator —
either would lock everyone out of an app whose only other way in is running a
script against the spreadsheet.

---

## If something does not work

| What you see | What it usually means |
| --- | --- |
| `Missing required environment variable(s)` | A value is absent from `.env.local` or from the Vercel project. |
| `GOOGLE_PRIVATE_KEY could not be read as a PKCS#8 private key` | The key is truncated, or its `\n` sequences were turned into real line breaks. Re-copy it from the JSON file. |
| `Google refused the service account credentials` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` does not match the key, or the key has been deleted in Google Cloud. |
| `Google Sheets API 403 ... is the spreadsheet shared with the service account as an Editor?` | Step 3 was missed, or the sharing was removed. |
| `Google Sheets API 404` | `FEES_SHEET_ID` is wrong. |
| `Sheet tab "Users" is empty` | The spreadsheet was cleared. Re-run `npm run bootstrap-sheet`. |
| Sign-in says "Too many failed attempts" | Five wrong passwords. It clears itself after 15 minutes; an administrator resetting the password clears it at once. |
