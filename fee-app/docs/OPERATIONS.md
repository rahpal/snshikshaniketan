# Running the fee register

For whoever looks after the app. Day-to-day use is in
[STAFF-GUIDE.md](STAFF-GUIDE.md); first-time setup is in [SETUP.md](SETUP.md).

---

## The short version

| When | What |
| --- | --- |
| Every day | Nothing. The office records payments; the app looks after itself. |
| Every week | The backup runs on Sunday night. Glance at the backup spreadsheet once a month to confirm the date on its **Snapshot** tab is recent. |
| Every April | Import the new year's student list. **This is the one job that cannot be skipped** — see below. |
| When staff change | Create or switch off accounts on the **Users** screen. |
| If fees change | Update the **Fee structure** screen, or leave it and let the form follow what is actually being paid. |

---

## April: the new academic year

The student list is held **per academic year**, because a child is in Class 5 in
one year and Class 6 in the next. Payments are filed the same way.

So in April, before the first fee is collected:

1. Export or write a CSV of every student with the class they are **now** in.
2. Open **Students**, choose the new academic year at the top, and import it.

Until that is done, the new year's class-wise view will be empty, and recording
a payment will quietly add that one student to the new year's list rather than
the whole class. Nothing breaks — but "who has not paid" cannot be right until
the list is there.

The previous year stays exactly as it was. Switch the academic year selector at
the top of any screen to look back at it, or to record a late payment against
it.

> There is no "move everyone up a class" button. With a few hundred students a
> CSV re-import is quicker and safer than a tool that could silently promote a
> child who has left. If that changes, it is a small feature to add.

---

## Backups

The register lives in one Google spreadsheet. Two things protect it:

1. **Google's own version history** (File → Version history in the
   spreadsheet). Excellent for "somebody deleted a row this morning". It does
   nothing if the file itself is lost.
2. **The weekly backup**, which copies every tab into a second spreadsheet the
   school also owns. That is what survives the live file being deleted, cleared
   or shared with the wrong person.

### Turning the backup on

1. Create a second spreadsheet in the same Google account, named something like
   `SNS Fee Register — backup`.
2. Share it with the same service account email as Editor (exactly as in
   [SETUP.md](SETUP.md) step 3).
3. Copy its id from the address bar into the fee-app Vercel project as
   `BACKUP_SHEET_ID`, and redeploy.
4. Optional but recommended: set `CRON_SECRET` to a random string
   (`openssl rand -hex 32`) so only Vercel's scheduler can trigger the job.

It then runs every Sunday at 18:30 UTC — midnight on Monday in India. An
administrator can also run it by hand at any time by opening
`/api/cron/backup` while signed in, which is worth doing before anything risky.

The backup file is **overwritten** each run rather than piling up dated copies.
Its own version history gives you the older ones.

### Checking it works

Open the backup spreadsheet and look at the **Snapshot** tab. It shows when the
last copy ran and how many rows each tab had. If the date is old, the job is
not running: check `BACKUP_SHEET_ID` is set in Vercel, and that the backup
spreadsheet is still shared with the service account.

---

## When something goes wrong

### "I can't sign in"

- **Wrong username or password** — the message is deliberately the same for
  both, so it reveals nothing. Check the username with them.
- **"Too many failed attempts"** — five wrong passwords locks the account for
  15 minutes. It clears itself, or an administrator can use **Reset password**,
  which clears the lockout immediately.
- **"This account has been deactivated"** — someone switched it off on the
  Users screen. Switch it back on.
- **"Too many sign-in attempts from this device"** — a lot of failures from one
  place in a short time. Wait a few minutes.

### "A payment was recorded wrongly"

Open the receipt (from the student's record, or the class-wise view).

- **The date, how it was paid, or the remarks are wrong** → *Correct the
  details*. The change is logged.
- **The amount, the months, or the student are wrong** → *Cancel this receipt*
  with a reason, then record it again properly. Both halves stay in the
  register, which is the point: a correction that hides the original is how
  books stop being trustworthy.

Only administrators see these. That is the rule the school asked for.

### "A student is missing from the class-wise view"

They are not on that year's student list. Either import the list (see April,
above) or add them on the **Students** screen. Recording a payment for them
also adds them.

### "The dashboard says the spreadsheet needs attention"

It names what is wrong. Almost always one of:

- a tab was renamed or deleted → run `npm run bootstrap-sheet` to recreate it;
- the spreadsheet was un-shared from the service account → re-share it as
  Editor;
- the service-account key was deleted or rotated in Google Cloud → update
  `GOOGLE_PRIVATE_KEY` in Vercel.

### "Money appears under a student who is not on the list"

The class-wise view shows this separately rather than dropping it, because
collected money must never vanish from a report. It happens if a student row is
removed while their payments remain. Add the student back to the list with the
same name and class and the payments reattach.

---

## Things worth knowing before changing anything

- **The app is the write path.** The tabs are protected with a warning so a
  hand edit asks "are you sure" first. Reading the spreadsheet directly is fine
  and often useful; typing in it is how columns end up misaligned.
- **Nothing is ever deleted** by the app. Cancelled payments stay with a
  `void` status; switched-off users stay so the audit log can still name them.
- **Column order does not matter.** The app finds columns by their heading, so
  inserting a column in the spreadsheet is safe. Renaming one is not.
- **Changing `SESSION_SECRET` signs everyone out.** That is the intended way to
  end every session at once if a laptop is lost.
- **Server messages are in English** even when the app is set to Hindi. The
  interface is translated; validation messages from the server are not.

---

## Where everything lives

Fill this in and keep it with the school's other records:

- Google account owning the spreadsheets: `bkpal161@gmail.com`
- Spreadsheet id (`FEES_SHEET_ID`): `__________`
- Backup spreadsheet id (`BACKUP_SHEET_ID`): `__________`
- Google Cloud project with the service account: `__________`
- Vercel account and project: `__________`
- App address: `__________`
- Administrators: `__________`

Credential handling and rotation are in [SECURITY.md](SECURITY.md).
