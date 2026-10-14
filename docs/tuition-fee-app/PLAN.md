# Tuition Fee Repository — Implementation Plan

S.N.S. Shiksha Niketan · internal fee-collection app
Status: **Phases 0, 1 and 2 built** · Branch: `claude/tuition-fee-app-7ip94f`

| Phase | State |
| --- | --- |
| 0 — Scaffold, Sheets layer, bootstrap script, docs | **done** |
| 1 — Authentication, roles, forced password change, lockout | **done** |
| 2 — Payment entry form, receipt, student list with CSV import | **done** |
| 3 — Class-wise view, student record, pending fees | **done** |
| 4 — Admin: users, fee structure, void/edit, audit | not started |
| 5 — Hardening and handover | not started |

The app lives in [`fee-app/`](../../fee-app/). Setup instructions are in
[`fee-app/docs/SETUP.md`](../../fee-app/docs/SETUP.md); credential handling is in
[`fee-app/docs/SECURITY.md`](../../fee-app/docs/SECURITY.md). 68 tests run the
real handlers against an in-memory fake of the Sheets API, so `npm test` needs
no credentials.

**Open question:** when a month costs more because of an exam or admission fee, the
amount is recorded as the higher monthly figure, with the reason in Remarks. Itemising it
as a separate charge line would allow reporting tuition separately from other collections;
it can be added later without disturbing anything already recorded.

**Settled with the school:** the spreadsheet is owned by `bkpal161@gmail.com`;
classes are NUR, KG and 1–8 with **no sections**; the first administrator is
`bkpal` (BK Pal); the student list exists already and is loaded by CSV import;
no fee-per-class table for now, so the amount is typed on each entry.

---

## 1. Summary

A **separate, self-contained app** in this repo, living in a new `fee-app/` directory with
its own `package.json`, build, and Vercel project. Nothing in the existing website is
touched — not `vercel.json`, not `App.jsx`, not the root `package.json`, not the existing
workflow. The two apps share a repository and nothing else.

Staff log in, record tuition-fee payments, and see per class and per month which students
have paid and which have not. Google Sheets is the system of record; all reads and writes
go through server-side API functions so no Google credential ever reaches the browser.

Two roles:

| Capability | Admin | Operator (non-admin) |
| --- | --- | --- |
| Log in | ✅ | ✅ |
| View class-wise / month-wise fee status | ✅ | ✅ |
| Record a new payment | ✅ | ✅ |
| Print / re-print a receipt | ✅ | ✅ |
| Edit or void an existing payment | ✅ | ❌ |
| Manage student roster & fee structure | ✅ | ❌ |
| Create users, reset passwords, deactivate | ✅ | ❌ |
| Export CSV, view audit log | ✅ | ❌ |

---

## 2. Repository layout

```
snshikshaniketan/
├── src/, index.html, vercel.json, package.json   ← existing public site, UNCHANGED
├── .github/workflows/deploy.yml                  ← existing, UNCHANGED
├── docs/tuition-fee-app/PLAN.md                  ← this file
└── fee-app/                                      ← the new app, fully self-contained
    ├── package.json          own deps, own scripts, own lockfile
    ├── vite.config.js
    ├── vercel.json           own rewrites + security headers
    ├── index.html
    ├── .gitignore            node_modules, dist, .env*
    ├── .env.example
    ├── README.md             setup + run instructions
    ├── api/                  Vercel serverless functions (the only place secrets exist)
    │   ├── _lib/             sheets client, session, guards, schemas, audit
    │   ├── auth/             login, logout, me, change-password
    │   ├── payments/         create, list, void, update
    │   ├── students/         list, create, update, import
    │   └── admin/            users, fee-structure, audit
    ├── scripts/
    │   └── bootstrap-sheet.mjs   creates the five tabs + first admin user
    └── src/                  React app (own Tailwind config, own theme)
```

Why a top-level `fee-app/` rather than `apps/fee-app/`: the repo root *is* the public
site, so introducing an `apps/` convention would imply moving the existing app into it —
which is exactly the change you asked me not to make.

---

## 3. Architecture

```
Browser (fee-app React SPA)
        │  fetch() with httpOnly session cookie
        ▼
Vercel Serverless Functions  (fee-app/api/*)   ← secrets live only here
        │  service-account JWT -> Sheets REST API
        ▼
Google Spreadsheet  (owned by the school's Gmail account)
   tabs: Users · Students · Payments · FeeStructure · AuditLog
```

**Why this shape**

- **The browser never holds a Google credential.** A service-account key in frontend code,
  or a "publish sheet to web" link, would expose every student's data to anyone who views
  source. All Sheets access is proxied through functions.
- **No server to run or pay for.** Vercel gives the `api/` directory serverless functions
  with no extra infrastructure.
- **Separate deployment = separate blast radius.** A bad deploy of the fee app cannot take
  down the public website, and the public site's build never pulls in `googleapis`.

**Considered and rejected**

- **Google Apps Script web app** as the backend. Security-wise fine (runs as the sheet
  owner, so there is no key to store) and the better choice if the school ever drops
  Vercel. Rejected as primary because deployments live outside the repo, CORS and auth are
  awkward, cold latency is 1–3 s, and it is hard to test. Kept as a documented fallback.
- **Sheets API straight from the browser with Google sign-in.** Would require every staff
  member to have a Google account on the sheet, contradicting "username and password given
  by the admin", and would give whoever signs in direct edit rights to the raw sheet.
- **A real database (Postgres/Supabase).** Technically better, but the requirement is
  explicitly Google Sheets so the office can open it on a phone. The data model below is
  normalized enough to port later without rework.

**The cost of separation, stated honestly:** the fee app does not reuse the public site's
`ThemeContext`, `LanguageContext`, or UI components. That means re-establishing Tailwind
and a dark-mode toggle in the new app (~40 lines, copied not imported) and its own small
set of translation strings. In exchange, neither app can break the other. Given this is
internal staff software with a completely different layout from a marketing site, the
duplication is worth it. The only shared asset I will copy is `public/sn_logo.jpeg`, for
the login screen and printed receipts.

---

## 4. Deployment

The fee app becomes a **second Vercel project** pointed at the same GitHub repo, with
**Root Directory = `fee-app`**. Vercel then builds and deploys only that folder.

- Recommended: set it up through the Vercel dashboard's Git integration, with an
  "Ignored Build Step" so the fee app only rebuilds when `fee-app/**` changes. This adds
  **zero files** to the repo and leaves the existing GitHub Actions workflow alone.
- Alternative, if you prefer everything in CI: a new
  `.github/workflows/deploy-fee-app.yml` mirroring the existing one but with
  `working-directory: fee-app` and its own `VERCEL_PROJECT_ID_FEE_APP` secret. This is a
  *new* file, so it still changes nothing existing — say the word and I will add it
  instead.
- Suggested hostname: `fees.snshikshaniketan.com` (or the free
  `sns-fees.vercel.app`). The public site's domain and DNS records are untouched; this
  adds one CNAME.
- The fee app ships `X-Robots-Tag: noindex` headers and a `robots.txt` that disallows
  everything, so staff pages never reach search results.

---

## 5. Data model (Google Sheets tabs)

Row 1 of every tab is a frozen header. The app addresses columns **by header name**, so
inserting a column later does not break it. All tabs get **protected ranges**, so stray
manual edits require the sheet owner's confirmation — the app is the intended write path.

### `Users`
| column | notes |
| --- | --- |
| `user_id` | ULID |
| `username` | unique, lowercase, trimmed |
| `password_hash` | bcrypt, cost 12 — **never a plaintext password** |
| `role` | `admin` \| `operator` |
| `full_name` | |
| `active` | `TRUE`/`FALSE` — deactivate, never delete |
| `must_change_password` | `TRUE` after an admin creates or resets the account |
| `failed_attempts`, `locked_until` | lock for 15 min after 5 bad tries |
| `last_login_at`, `created_at`, `created_by` | |

### `Students` — the roster (**required**, see §6)
`student_id` (ULID) · `academic_year` · `class` · `section` · `student_name` ·
`parent_name` · `contact` · `admission_date` · `active` · `concession_pct` · `notes`

### `Payments` — one row per (receipt × month)
`row_id` · `receipt_no` · `academic_year` · `class` · `section` · `student_id` ·
`student_name` · `parent_name` · `month` (`2026-04`) · `amount` (allocated to that month) ·
`receipt_total` · `payment_date` · `payment_mode` (cash/UPI/cheque/bank) · `remarks` ·
`entered_by` · `entered_at` · `status` (`active`/`void`) · `voided_by` · `voided_at` ·
`void_reason`

> Paying for three months writes **three rows** sharing one `receipt_no`. This is the key
> modelling choice: the class-wise matrix, the dues report, and any pivot table become a
> direct filter instead of parsing a comma-separated month list out of a cell. The receipt
> screen groups rows back together by `receipt_no`.

### `FeeStructure`
`academic_year` · `class` · `monthly_fee` · `effective_from` — drives the suggested amount
on the form and the "expected vs collected" figures.

### `AuditLog`
`timestamp` · `user` · `action` (`login`, `payment.create`, `payment.void`, `user.create`, …)
· `entity_id` · `before` · `after` (JSON) · `ip`

Nothing is ever hard-deleted. Corrections are a **void + re-entry**, both visible.

---

## 6. The one gap in the requirements

> "Class-wise tuition fee view. Who has paid and not paid, month-wise."

Payment records alone can only answer *who paid*. "Who has **not** paid" needs a list of
who was expected to pay — a student roster per class per academic year. So the plan adds a
`Students` tab and an admin roster screen (add/edit, plus CSV import for the initial
load). Without it, the headline feature cannot exist.

Related additions, all small, that make it usable in practice:

- **April–March academic year.** Months run Apr → Mar and `academic_year` is stored as
  `2026-27`. A Jan–Dec assumption would misreport every year-end.
- **Duplicate guard.** Before writing, the server checks for an existing *active* payment
  for the same (student, academic_year, month) and returns a conflict the UI shows as
  "Arjun has already paid for June (receipt SNS-2627-0041) — continue anyway?".
- **Receipt number + printable receipt.** Parents expect one: A5 print view with the
  school logo, shareable as a PDF or screenshot on WhatsApp. Months paid ahead for are
  marked *(advance)*, worked out from the month and the payment date rather than stored,
  so the parent's copy shows what they are covered for.
- **Months that cost different amounts.** Each month on a receipt stores the amount
  entered against it, so an exam month, a part payment or a mid-year fee change is
  recorded as what it was rather than averaged away. `concession_pct` on a student adjusts
  the expected figure so a scholarship student is not flagged as a defaulter.
- **Defaulters report.** Every student with an unpaid month up to the current month, with
  parent contact — the thing the office actually needs printed.
- **Hindi + English** labels, matching the public site's bilingual approach.
- **Backup.** A weekly Vercel cron (or Apps Script trigger) copies the spreadsheet to a
  dated file in Drive. Sheets version history is good, but it is not a backup against
  accidental deletion or re-sharing.

---

## 7. Credentials & secrets

| Secret | Stored in | Notes |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Vercel env var (fee-app project) | |
| `GOOGLE_PRIVATE_KEY` | Vercel env var | newlines escaped as `\n` |
| `FEES_SHEET_ID` | Vercel env var | |
| `SESSION_SECRET` | Vercel env var | 32+ random bytes, signs session JWTs |
| Staff passwords | `Users` tab, bcrypt hash only | plaintext exists only in the admin's one-time handover |

- Env vars live on the **fee-app Vercel project only**; the public site's project never
  sees them.
- Local development uses `fee-app/.env.local`, ignored by `fee-app/.gitignore`, with a
  committed `.env.example` holding empty values.
- The service account is created in a dedicated Google Cloud project with **only** the
  Sheets API enabled, and the spreadsheet is shared with that account's email as Editor.
  It can reach exactly one spreadsheet and nothing else in the school's Drive.
- The spreadsheet is never set to "anyone with the link" — sharing stays restricted to the
  school Gmail account and the service account.
- Rotation steps for the service-account key and `SESSION_SECRET` (which logs everyone
  out, by design) are documented in `fee-app/docs/SECURITY.md`, along with who holds the
  Gmail password and how a departing staff member's account is deactivated.

### Session & request security

- Session is a **JWT in an httpOnly, Secure, SameSite=Strict cookie**, 8-hour expiry,
  carrying `user_id` and `role`. No token in `localStorage`, which XSS can read.
- **Every** API handler re-checks the role from the verified cookie. The UI hiding a
  button is cosmetic; the write handlers are what actually enforce "operators cannot
  update entries".
- All request bodies validated with `zod` before reaching the Sheets layer.
- Login throttling via `failed_attempts`/`locked_until` on the user row — serverless
  functions share no memory, so the counter lives in the sheet.
- Reads cached in-process for 30–60 s to stay inside Sheets' per-minute quota.

---

## 8. Screens

Routes are at the app's own root (it has its own hostname), not under a `/fees` prefix.

| Route | Who | What |
| --- | --- | --- |
| `/login` | all | Username + password. No sign-up link anywhere. |
| `/` | all | Dashboard: collected this month, pending count, recent receipts, quick links. |
| `/collect` | all | The payment entry form (§9). |
| `/classwise` | all | **The main view.** Class + academic-year selector; grid of students (rows) × Apr–Mar (columns). Green = paid, with the amount; red = owed; a faint dot = a month that has not come round yet. That last distinction is what makes the grid readable: painting every unpaid month red would show half the year in alarm from April and teach everyone to ignore the colour. Row totals, per-month column totals, collected/with-dues/months-owed summary, and a CSV download for admins. Money recorded against a student no longer on the roster is reported separately rather than dropped. |
| `/students/:id` | all | One student's full ledger. |
| `/receipt/:receiptNo` | all | Printable receipt. |
| `/defaulters` | all | Unpaid list with parent contacts, filterable by class. |
| `/roster` | admin | Student CRUD + CSV import. |
| `/structure` | admin | Per-class monthly fee. |
| `/users` | admin | Create user, set role, reset password, deactivate. |
| `/audit` | admin | Audit log, newest first. |
| `/payments/:receiptNo/edit` | admin | Correct or void a receipt; reason required. |

Operators see admin routes neither in the nav nor on direct URL entry (route guard), and
the API refuses them regardless.

---

## 9. The payment form

Fields, in entry order:

1. **Academic year** — defaults to the current Apr–Mar year.
2. **Class** — dropdown from the roster (Nursery … VIII, per the existing site).
3. **Student** — searchable dropdown filtered by class; auto-fills **parent name**
   (editable). Free-text entry is allowed with a warning when the student is not yet on
   the roster, so a payment is never blocked by missing data.
4. **Months paid** — Apr–Mar grid. Already-paid months are shown with their amount and
   locked. Every other month is labelled by where it stands against the payment date —
   *Due* (this month or earlier), *This month*, or *Advance* — because one deposit
   routinely clears arrears and pays ahead at once, and April and December otherwise look
   identical in October. A *"Select the N months still due"* action takes all the arrears
   in one click. Choosing a month ahead while an earlier one is unpaid raises a prompt
   listing them, with a button to add them to the same receipt; it never blocks, since
   paying ahead is legitimate. A receipt covers one academic year, so dues from an earlier
   year are recorded against that year.
5. **Amount, per month** — one box, pre-filled with the amount this class most commonly
   pays, worked out from what has actually been collected, so there is no fee table to
   maintain. A link, *"Different amount for some months?"*, opens a box per month seeded
   with that figure, for an exam month, a part payment, or a fee that changed mid-year; a
   month differing from the usual figure is flagged amber as a prompt to check, never as a
   blocker. The total is shown prominently and is always the sum of the months — it is
   never typed, and the app never divides a total, because dividing invents per-month
   figures that nobody entered and that the class-wise view would then report.
6. **Payment date** — the day the parent handed the money over. Opens already set to
   today, so the common case needs no thought, but stays editable because the office often
   records on Monday what was paid on Saturday. It cannot be in the future, enforced on the
   server and not merely capped in the browser, and "today" means today at the school
   rather than wherever a server runs — at 8pm UTC it is already tomorrow in Kolkata.
   It also cannot predate the academic year it is filed under: for 2026-27, nothing before
   1 March 2026. The bound sits a month ahead of the April start rather than on it, because
   fees for a session are routinely collected in the weeks before it begins, and refusing a
   genuine March payment would only push the office into entering a false date. Its job is
   catching a mistyped year — a 2026-27 receipt dated 2025-06-10. Clearing an earlier
   year's dues is unaffected: those are filed under that year, so they are judged against
   its own start.
   Recorded separately from `entered_at`, the untouchable timestamp of when the row was
   written, so a backdated entry still shows when it was actually typed and by whom.
7. **Payment mode** — cash / UPI / cheque / bank transfer.
8. **Remarks** — free text.
9. **Entered by** — taken from the session, never typed.

On submit: validate → duplicate check → append one row per month sharing a receipt number
→ write an audit entry → return the receipt number → show the printable receipt with
"Record another payment".

Receipt numbers are `SNS-2627-<ULID suffix>`: unique without a shared counter, because two
staff submitting at the same moment on different serverless instances cannot safely
increment a cell. A human-friendly sequence column can be added later as a sheet formula.

---

## 10. Build phases

Each phase ends in a working, deployable state and a commit on
`claude/tuition-fee-app-7ip94f`. Every file created lives under `fee-app/` or
`docs/tuition-fee-app/`.

**Phase 0 — Scaffold the app** *(nothing existing modified)*
- `fee-app/` with its own `package.json`, Vite + React 19 + Tailwind v4 config (matching
  the versions the public site already uses), `index.html`, `.gitignore`, `.env.example`,
  `vercel.json` with API-safe rewrites and `noindex` headers, `robots.txt`.
- `fee-app/api/_lib/`: Sheets client, header-mapped row read/write helpers, session
  sign/verify, `requireAuth`/`requireAdmin` guards, zod schemas, audit writer.
- Dependencies kept deliberately small: `jose`, `bcryptjs`, `zod`. The
  service-account token exchange is ~40 lines against the REST API rather than
  the `googleapis` client, which cuts the function bundle (and so cold-start
  latency) and routes every call through `fetch`, so tests can intercept it.
- `fee-app/scripts/bootstrap-sheet.mjs`: creates all five tabs with headers, protections,
  and the first admin user.
- `fee-app/README.md` + `docs/SETUP.md`: step-by-step Google Cloud, service account,
  spreadsheet, and Vercel project setup.

**Phase 1 — Auth** → `/login` works, session cookie issued, routes guarded, forced
password change at first login, logout, lockout.

**Phase 2 — Entry form** → the full form of §9 writing to `Payments`, with duplicate
detection, receipt number, printable receipt, audit entry.

**Phase 3 — Views** → class-wise month-wise matrix, student ledger, dashboard, defaulters
report.

**Phase 4 — Admin** → user management, roster + CSV import, fee structure, edit/void with
reason, audit log viewer, CSV export.

**Phase 5 — Hardening & handover** → rate limiting, loading/error/empty states, mobile
layout (the office works from a phone), Hindi strings, backup cron, an `OPERATIONS.md`
runbook, and a short staff guide in Hindi and English.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Sheets API quota (60 reads/min/user) on a busy morning | in-process caching, batched range reads, one write per receipt |
| Two staff entering the same payment at once | ULID receipt numbers, duplicate check, append-only writes |
| Someone hand-edits the sheet and breaks a column | header-name addressing, protected ranges, documented "use the app" rule |
| Vercel Hobby plan is non-commercial, and this would be a second project on it | confirm the school's plan; a Pro seat or the Apps Script fallback both resolve it |
| Student data in a spreadsheet | restricted sharing, no financial instrument data stored, bcrypt-only passwords, audit log |
| Gmail account recovery | document 2FA and a recovery contact for the owning account |
| Two apps in one repo drift apart | they are independent by design; only `sn_logo.jpeg` is duplicated, and the fee app pins the same React/Vite/Tailwind majors |

---

## 12. What I need from you

1. The **Gmail account** that should own the spreadsheet (the app never sends email; it
   just needs an owner).
2. Confirmation to use **Vercel functions** (recommended) rather than the Apps Script
   fallback — and whether you want the second Vercel project set up via the **dashboard**
   (no new files) or a **new GitHub Actions workflow**.
3. The **hostname** for the fee app (`fees.snshikshaniketan.com`, or just the free
   `*.vercel.app` URL for now).
4. The **class list and monthly fee per class**, and whether sections (A/B) are used.
5. The **first admin's** username and full name — I will generate a temporary password and
   hand it over once, out of band.
6. Whether a **student roster** exists anywhere (any spreadsheet or register) that can be
   CSV-imported, or whether staff will add students as payments come in.

I can start Phase 0 and Phase 1 before any of these are answered — the scaffold, the setup
script, and the auth layer do not depend on them.
