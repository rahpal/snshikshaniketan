# Tuition Fee Repository — Implementation Plan

S.N.S. Shiksha Niketan · internal fee-collection app
Status: **plan / awaiting approval** · Branch: `claude/tuition-fee-app-7ip94f`

---

## 1. Summary

A password-protected section of the existing website (`/fees/*`) where school staff record
tuition-fee payments and see, per class and per month, which students have paid and which
have not. Google Sheets remains the system of record; all reads and writes go through
server-side API functions so that no Google credential ever reaches the browser.

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

## 2. Architecture

```
Browser (React SPA, /fees/*)
        │  fetch() with httpOnly session cookie
        ▼
Vercel Serverless Functions  (/api/fees/*)   ← secrets live only here
        │  googleapis + service-account JWT
        ▼
Google Spreadsheet  (owned by the school's Gmail account)
   tabs: Users · Students · Payments · FeeStructure · AuditLog
```

### Why this shape

- **The browser never holds a Google credential.** A service-account key in frontend code
  or a "publish sheet to web" link would expose every student's data to anyone who views
  source. All Sheets access is proxied.
- **No separate server to run or pay for.** The repo already deploys to Vercel; adding an
  `api/` directory gets functions for free with the existing workflow.
- **One codebase.** Reuses the current Tailwind theme, dark mode, and Hindi/English
  translation context. The `/fees` bundle is lazy-loaded so the public site stays as fast
  as it is today.

### Considered and rejected

- **Google Apps Script web app** as the backend. Fine security-wise (the code runs as the
  sheet owner, so there is no key to store), and it is the better choice if the school ever
  wants to drop Vercel. Rejected as primary because: Apps Script deployments are managed
  outside the repo, CORS and auth handling are awkward, cold latency is ~1–3 s, and
  testing is painful. Keeping it as a documented fallback.
- **Sheets API straight from the browser with OAuth sign-in.** Would force every staff
  member to have a Google account on the sheet, which contradicts "username and password
  given by the admin", and gives whoever signs in direct edit rights to the raw sheet.
- **A real database (Postgres/Supabase).** Technically better, but the requirement is
  explicitly Google Sheets — the headmaster/accountant can open it on a phone. Noted as a
  future migration path; the data model below is normalized enough to port directly.

---

## 3. Data model (Google Sheets tabs)

Row 1 of every tab is a frozen header. The app addresses columns by header name, so
inserting a column later does not break it. All tabs get **protected ranges** so stray
manual edits require the sheet owner's confirmation — the app is the intended write path.

### `Users`
| column | notes |
| --- | --- |
| `user_id` | ULID |
| `username` | unique, lowercase, trimmed |
| `password_hash` | bcrypt, cost 12 — **never a plaintext password** |
| `role` | `admin` \| `operator` |
| `full_name` | |
| `active` | `TRUE`/`FALSE` — deactivate instead of deleting |
| `must_change_password` | `TRUE` after admin creates/resets |
| `failed_attempts`, `locked_until` | lockout after 5 bad tries for 15 min |
| `last_login_at`, `created_at`, `created_by` | |

### `Students` — the roster (**required**, see §4)
`student_id` (ULID) · `academic_year` · `class` · `section` · `student_name` ·
`parent_name` · `contact` · `admission_date` · `active` · `concession_pct` · `notes`

### `Payments` — one row per (receipt × month)
`row_id` · `receipt_no` · `academic_year` · `class` · `section` · `student_id` ·
`student_name` · `parent_name` · `month` (`2026-04`) · `amount` (allocated to that month) ·
`receipt_total` · `payment_date` · `payment_mode` (cash/UPI/cheque/bank) · `remarks` ·
`entered_by` · `entered_at` · `status` (`active`/`void`) · `voided_by` · `voided_at` ·
`void_reason`

> Paying for three months writes **three rows** sharing one `receipt_no`. This is the key
> modelling choice: the class-wise matrix, the dues report and any pivot table become a
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

## 4. The one gap in the requirements

> "Class-wise tuition fee view. Who has paid and not paid, month-wise."

Payment records alone can only answer *who paid*. "Who has **not** paid" needs a list of
who was expected to pay — i.e. a student roster per class per academic year. So the plan
adds a `Students` tab and an admin roster screen (add/edit students, CSV import for the
initial load). Without it, the headline feature cannot exist.

Related additions, all small, that make the thing usable in practice:

- **April–March academic year.** Months are ordered Apr → Mar, and `academic_year` is
  stored as `2026-27`. Hard-coding Jan–Dec would misreport the year-end.
- **Duplicate guard.** Before writing, the server checks for an existing *active* payment
  for the same (student, academic_year, month) and returns a conflict the UI surfaces as
  "Arjun has already paid for June (receipt SNS-2627-0041) — continue anyway?".
- **Receipt number + printable receipt.** Parents expect one. Printable A5 view with the
  school logo, shareable as a PDF/screenshot on WhatsApp.
- **Partial payments & concessions.** `amount` is free-text-editable (pre-filled from
  `FeeStructure`), and `concession_pct` on a student adjusts the expected figure so a
  scholarship student is not flagged as a defaulter.
- **Defaulters report.** Students with any unpaid month up to the current month, with
  parent contact — the thing the office actually needs printed.
- **Hindi/English.** Reuses the existing `useTranslation` hook; the staff UI gets the same
  toggle as the public site.
- **Backup.** A weekly Vercel cron (or Apps Script trigger) copies the spreadsheet to a
  dated file in Drive. Sheets' own version history is good but not a backup against
  accidental sharing or deletion.
- **`noindex`** on all `/fees` routes plus `robots.txt` exclusion, so staff pages never
  appear in search results.

---

## 5. Credentials & secrets

| Secret | Stored in | Notes |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Vercel env var (Production + Preview) | |
| `GOOGLE_PRIVATE_KEY` | Vercel env var | newlines escaped as `\n` |
| `FEES_SHEET_ID` | Vercel env var | |
| `SESSION_SECRET` | Vercel env var | 32+ random bytes, used to sign session JWTs |
| Staff passwords | `Users` tab, bcrypt hash only | plaintext exists only in the one-time handover from admin |

- Local development uses `.env.local`, which is already gitignored (`*.local`); the plan
  also adds an explicit `.env*` rule and a committed `.env.example` with empty values.
- The service account is created in a dedicated Google Cloud project with **only** the
  Sheets API enabled, and the spreadsheet is shared with that account's email as Editor.
  It can touch exactly one spreadsheet and nothing else in the school's Drive.
- The spreadsheet itself is never set to "anyone with the link"; sharing stays restricted
  to the school Gmail account and the service account.
- Key rotation: documented steps to issue a new service-account key and rotate
  `SESSION_SECRET` (which logs everyone out — by design).
- `SECURITY.md` for the fee app covers: who holds the Gmail password, how a departing
  staff member's account is deactivated, and that admins hand over a temporary password
  which the user must change at first login.

### Session & request security

- Session is a **JWT in an httpOnly, Secure, SameSite=Strict cookie**, 8-hour expiry,
  carrying `user_id` and `role`. No token in `localStorage` (XSS-readable).
- **Every** API handler re-checks the role from the verified cookie. The UI hiding a
  button is cosmetic; the write handlers are what actually enforce "operators cannot
  update entries".
- All request bodies validated with `zod` before they reach the Sheets layer.
- Login throttling via `failed_attempts`/`locked_until` on the user row (serverless
  functions have no shared memory, so the counter lives in the sheet).
- Reads are cached in-process for 30–60 s to stay well inside Sheets' per-minute quota.

---

## 6. Screens

| Route | Who | What |
| --- | --- | --- |
| `/fees/login` | all | Username + password. No public sign-up link anywhere. |
| `/fees` | all | Dashboard: collected this month, pending count, recent receipts, quick links. |
| `/fees/collect` | all | The payment entry form (§7). |
| `/fees/classwise` | all | **The main view.** Class + academic-year selector; grid of students (rows) × Apr–Mar (columns). Green = paid (amount + receipt link on hover), red = due, grey = not applicable. Totals per row and column, "X of Y students fully paid", export CSV (admin). |
| `/fees/students/:id` | all | One student's full ledger. |
| `/fees/receipt/:receiptNo` | all | Printable receipt. |
| `/fees/defaulters` | all | Unpaid list with parent contacts, filterable by class. |
| `/fees/roster` | admin | Student CRUD + CSV import. |
| `/fees/structure` | admin | Per-class monthly fee. |
| `/fees/users` | admin | Create user, set role, reset password, deactivate. |
| `/fees/audit` | admin | Audit log, newest first. |
| `/fees/payments/:receiptNo/edit` | admin | Correct or void a receipt, reason required. |

Operators see the admin routes neither in the nav nor on direct URL entry (route guard),
and the API refuses them regardless.

---

## 7. The payment form

Fields, in entry order:

1. **Academic year** — defaults to the current Apr–Mar year.
2. **Class** — dropdown from the roster (Nursery … VIII, per the existing site).
3. **Student** — searchable dropdown filtered by class; auto-fills **parent name**
   (editable). Free-text entry allowed with a warning when the student is not yet on the
   roster, so a payment is never blocked by missing data.
4. **Months paid** — Apr–Mar checkbox grid. Already-paid months are pre-marked and
   disabled; the next unpaid month is pre-selected. Multiple selection is the normal case.
5. **Amount paid** — auto-computed as `months × monthly_fee − concession`, fully editable
   for partial payments. Shows the split per month when the amount is overridden.
6. **Payment date** — defaults to today, cannot be in the future.
7. **Payment mode** — cash / UPI / cheque / bank transfer.
8. **Remarks** — free text.
9. **Entered by** — taken from the session, not typed.

On submit: server validates → duplicate check → appends one row per month with a shared
receipt number → writes an audit entry → returns the receipt number → UI shows the
printable receipt with "Record another payment".

Receipt numbers are `SNS-2627-<ULID suffix>`: unique without a shared counter, because
two staff submitting at the same moment on different serverless instances cannot safely
increment a cell. A human-friendly sequence column can be added later as a sheet formula.

---

## 8. Build phases

Each phase ends in a working, deployable state and a commit on
`claude/tuition-fee-app-7ip94f`.

**Phase 0 — Groundwork** *(no user-visible change)*
- `vercel.json`: exclude `/api` from the SPA catch-all rewrite
  (`"source": "/((?!api/).*)"`), add security headers for `/fees`.
- Add deps: `googleapis`, `jose`, `bcryptjs`, `zod`.
- `api/_lib/`: sheets client, header-mapped row read/write helpers, session
  sign/verify, `requireAuth`/`requireAdmin` guards, zod schemas, audit writer.
- `docs/tuition-fee-app/SETUP.md`: step-by-step Google Cloud + service account +
  spreadsheet creation, and a `scripts/bootstrap-sheet.mjs` that creates all five tabs
  with headers, protections and the first admin user.
- `.env.example`, `.gitignore` update.

**Phase 1 — Auth** → `/fees/login` works, session cookie issued, `/fees` guarded, forced
password change on first login, logout, lockout.

**Phase 2 — Entry form** → the full form of §7 writing to `Payments`, with duplicate
detection, receipt number, printable receipt, audit entry.

**Phase 3 — Views** → class-wise month-wise matrix, student ledger, dashboard,
defaulters report.

**Phase 4 — Admin** → user management, roster + CSV import, fee structure, edit/void with
reason, audit log viewer, CSV export.

**Phase 5 — Hardening & handover** → rate limiting, loading/error/empty states, mobile
layout (the office uses a phone), Hindi strings, `noindex`, backup cron, an
`OPERATIONS.md` runbook, and a short staff guide in Hindi + English.

---

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Sheets API quota (60 reads/min/user) on a busy morning | in-process caching, batched range reads, one write per receipt |
| Two staff entering the same payment simultaneously | ULID receipt numbers, duplicate check, append-only writes |
| Someone hand-edits the sheet and breaks a column | header-name addressing, protected ranges, documented "use the app" rule |
| Vercel Hobby plan is non-commercial | confirm the school's plan; a Pro seat or the Apps Script fallback both resolve it |
| Student data in a spreadsheet | restricted sharing, no financial instrument data stored, bcrypt-only passwords, audit log |
| Gmail account recovery | document 2FA + recovery contact for the owning account |

---

## 10. What I need from you

1. The **Gmail account** that should own the spreadsheet (the app never emails anyone; it
   just needs to be the owner).
2. Confirmation I should use **Vercel functions** (recommended) rather than the Apps
   Script fallback.
3. The **class list and monthly fee per class**, and whether sections (A/B) are used.
4. The **first admin's** username and full name — I will generate a temporary password and
   hand it over once, out of band.
5. Whether a **student roster** exists anywhere (any spreadsheet or register) that can be
   CSV-imported, or whether staff will add students as payments come in.

I can start Phase 0 and Phase 1 before any of these are answered — the setup script and
auth layer do not depend on them.
