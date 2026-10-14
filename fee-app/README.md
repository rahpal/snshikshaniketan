# Fee Register — S.N.S. Shiksha Niketan

Internal staff app for recording tuition fee payments and seeing, class by class
and month by month, who has paid and who has not. Google Sheets is the system of
record.

This is a **separate application** from the public website at the repository
root. It has its own dependencies, its own build and its own Vercel project, and
it shares nothing with the website except the repository and the logo file.

- Plan and roadmap: [`../docs/tuition-fee-app/PLAN.md`](../docs/tuition-fee-app/PLAN.md)
- First-time setup: [`docs/SETUP.md`](docs/SETUP.md)
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
  with the amount split across them, a duplicate-payment guard, and a printable
  receipt
- **The student list**: CSV import, add one at a time, and automatic addition of
  anyone a payment is recorded for
- The spreadsheet bootstrap script, which creates the five tabs and the first
  administrator
- English and Hindi, light and dark, and a layout that works on a phone

The class-wise view, the pending-fees report, user management, the fee
structure and the activity log are Phases 3–4. Their screens exist in the
navigation and are marked "Soon".

### The school's setup

Classes are NUR, KG and 1 to 8, with no sections, as configured in
`shared/school.js`. There is no fee-per-class table yet, so staff type the
amount on each entry; adding one later changes only what the form pre-fills.

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
