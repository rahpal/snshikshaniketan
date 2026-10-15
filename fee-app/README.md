# Fee Register — S.N.S. Shiksha Niketan

Internal staff app for recording tuition fee payments and seeing, class by class
and month by month, who has paid and who has not. Google Sheets is the system of
record.

This is a **separate application** from the public website at the repository
root. It has its own dependencies, its own build and its own Vercel project, and
it shares nothing with the website except the repository and the logo file.

- Plan and roadmap: [`../docs/tuition-fee-app/PLAN.md`](../docs/tuition-fee-app/PLAN.md)
- First-time setup: [`docs/SETUP.md`](docs/SETUP.md)
- Running it, and what to do when something breaks: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- For the office, in Hindi and English: [`docs/STAFF-GUIDE.md`](docs/STAFF-GUIDE.md)
- Credentials and account handling: [`docs/SECURITY.md`](docs/SECURITY.md)

## What works today

Phases 0, 1 and 2 of the plan:

- Sign-in with a username and password issued by an administrator
- Sessions as a signed, httpOnly cookie; sign-out; 15-minute lockout after 5
  failed attempts
- Forced password change at first sign-in, and a password change screen after
  that
- Admin and operator roles, enforced on the server for every request
- **Recording a fee payment** covering any number of months on one receipt,
  with its own amount against each month, a duplicate-payment guard, and a
  printable receipt
- **The student list**: CSV import, add one at a time, and automatic addition of
  anyone a payment is recorded for
- **The class-wise view**: a register of students by month, showing what was
  paid, what is owed, and what is simply not due yet, with per-month totals and
  a CSV download
- **Pending fees**: who owes what, worst first, with parent contacts, printable
- **A student's own record**: every receipt for the year, with months and
  amounts
- **Accounts**: an administrator creates staff logins, issues and resets
  passwords, changes roles and switches accounts off
- **Corrections**: an administrator can cancel a receipt with a reason, or fix
  the details around a payment. The amounts and months are never editable
- **Fee structure** (optional) and the **activity log**
- **A weekly backup** into a second spreadsheet the school also owns, plus a
  per-address brake on repeated failed sign-ins
- The spreadsheet bootstrap script, which creates the five tabs and the first
  administrator
- English and Hindi, light and dark, and a layout that works on a phone

That is all five phases of the plan.

### The school's setup

Classes are NUR, KG and 1 to 8, with no sections, as configured in
`shared/school.js`. A fee per class can be set on the Fee structure screen but
does not have to be: with nothing set, the form pre-fills the amount a class
most commonly pays, worked out from what has actually been collected, so the
figure follows the fee by itself with nothing to maintain.

One deposit can clear **arrears** and pay **in advance** at the same time: every
month in the grid shows whether it is due, is this month, or is ahead, there is
a one-click "select the months still due", and the receipt marks the months paid
ahead for. Taking an advance while an earlier month is still open raises a
prompt - never a block - with a button to add those months to the same receipt.
A receipt covers one academic year; dues from an earlier year are recorded
against that year.

Amounts are entered **per month**, not as a total to be divided. One box covers
the usual case; a link opens a box per month when one of them differs - an exam
month, a part payment, a fee that changed mid-year. The receipt total is always
the sum of the months, and is never typed.

## Running it locally

```bash
cd fee-app
npm install
cp .env.example .env.local      # then fill it in - see docs/SETUP.md
npm run bootstrap-sheet -- --admin-username <you> --admin-name "Your Name"
npm run dev                     # needs the Vercel CLI: npm i -g vercel
```

`npm run dev` runs `vercel dev`, which serves the React app and the `api/`
functions together on one origin. `npm run dev:ui` runs Vite alone, which is
quicker but has no API, so sign-in will not work.

The session cookie is always marked `Secure`. Chrome and Firefox treat
`http://localhost` as a secure context and accept it, so local sign-in works in
those; Safari does not, so use Chrome or Firefox locally.

| Command | What it does |
| --- | --- |
| `npm run dev` | app + API locally (Vercel CLI) |
| `npm run build` | production build into `dist/` |
| `npm test` | the test suite, no network or spreadsheet needed |
| `npm run lint` | ESLint over the app, API, scripts and tests |
| `npm run bootstrap-sheet` | create/repair the spreadsheet tabs and first admin |
| `npm run bootstrap-sheet -- --check` | report what the spreadsheet is missing |

## How it fits together

```
src/                 React app. Knows nothing about Google; talks only to /api.
api/                 Vercel serverless functions. The only place secrets exist.
api/_lib/            Sheets client, session, guards, validation, audit.
scripts/             One-off setup, run from a developer's machine.
test/                Tests, including an in-memory fake of the Sheets API.
```

Two rules keep the data safe, and both are worth knowing before changing
anything here:

1. **No Google credential ever reaches the browser.** The service-account key
   lives in Vercel environment variables, is read only by `api/_lib/env.js`, and
   every spreadsheet read or write goes through a function.
2. **Authorisation is decided on the server, on every request.** `api/_lib/guards.js`
   re-reads the user's row and checks their role each time. The React route
   guards only decide what to draw; they are not what stops an operator editing
   a payment.

## Tests

`npm test` replaces `fetch` with an in-memory fake of the Sheets API
(`test/helpers/fake-sheets.mjs`), so the real handlers, the real session
signing, the real bcrypt hashing and the real range-building all run — against
a spreadsheet that lives in memory. No credentials, no network, nothing to clean
up afterwards.
