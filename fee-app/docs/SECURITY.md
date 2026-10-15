# Credentials and account handling

Who holds what, where it lives, and what to do when it needs to change.

## What the app stores

| Where | What | Notes |
| --- | --- | --- |
| Vercel environment variables (fee-app project) | service-account email and private key, spreadsheet id, session secret | Never in the repository. Not shared with the public website's project. |
| `Users` tab of the spreadsheet | usernames, bcrypt password hashes, roles, lockout state | Hashes only. A plaintext password exists only in the moment an administrator hands one over. |
| `Payments`, `Students` tabs | student names, parent names, contact numbers, amounts | No bank, card or UPI identifiers are recorded — only how a payment was made. |
| `AuditLog` tab | every sign-in, failure, and change, with the username and IP | Append-only in practice: the app never deletes from it. |
| The browser | a signed session cookie, plus the chosen language and theme | The cookie is httpOnly, so no script on the page can read it. |
| The backup spreadsheet (optional) | a weekly copy of every tab | Owned by the same Google account, shared with the same service account. Treat it exactly like the live file. |

No password is ever written to the audit log, a server log, or the browser.

## Who holds the keys

Fill this in and keep it current:

- **Google account owning the spreadsheet:** `__________` (2-step verification: on/off, recovery contact: `__________`)
- **Google Cloud project `sns-fee-register`:** owned by `__________`
- **Vercel account holding the fee-app project:** `__________`
- **Administrators of the app itself:** `__________`

Anyone in the first three rows can reach the data regardless of what the app
says, so keep those lists short.

## Routine jobs

### Adding a member of staff

An administrator creates the account and hands over the temporary password in
person. The app forces a change at first sign-in, which is what makes a
handed-over password acceptable: it stops working as soon as it has been used.

Give the office **operator**, not admin. An operator can view everything and
record payments but cannot change an entry after the fact, which is the point of
the role.

### Someone leaves

Set their account to inactive from the Users screen. Their next request fails
immediately — sessions are re-checked against the user's row on every request,
so there is no window to wait out. Do not delete the account: the audit log
refers to it.

### Someone forgets their password

An administrator resets it and hands over a new temporary one. The reset also
invalidates every session that person had open, and clears any lockout.

### A password may have been seen by someone else

Change it. That alone invalidates every session issued under the old password,
on every device.

## Rotating secrets

### Session secret

Generate a new one (`openssl rand -base64 48`), replace `SESSION_SECRET` in the
Vercel project, redeploy. **Everyone is signed out.** That is the intended way to
end all sessions at once — do it if a laptop is lost or a secret is exposed.

### Service-account key

1. In Google Cloud → Credentials → the `fee-app` service account → Keys, create a
   new JSON key.
2. Update `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` in the Vercel
   project and redeploy.
3. Confirm the dashboard's setup panel is green.
4. Only then delete the old key in Google Cloud.

Deleting the old key first takes the app down until step 2 is deployed.

### If a key has leaked

Delete it in Google Cloud immediately — that revokes it — then issue a new one.
A deleted key cannot be used even by someone holding a copy. Afterwards, read
the `AuditLog` tab and the spreadsheet's own version history (File → Version
history) for writes you cannot account for.

## Deliberate choices worth knowing

- **Sessions last 8 hours** and are re-validated against the user's row on every
  request. Deactivating an account or changing a password takes effect on the
  next request, not whenever a token happens to expire.
- **Five failed sign-ins lock an account for 15 minutes.** The counter lives in
  the spreadsheet because serverless functions share no memory. It is enough to
  stop password guessing at this scale; it is not a defence against a determined
  attacker with many IPs, which is not the threat here.
- **A second brake refuses repeated failures from one address**, in memory and
  therefore per serverless instance. Its job is not access control - the account
  lockout above is that - but cost: each attempt otherwise costs a bcrypt
  comparison and two spreadsheet writes, and a flood could exhaust the Sheets
  API quota and take the register down for the office. Being per instance, an
  attacker spread across instances gets a higher ceiling than the numbers
  suggest. That is accepted, and nothing relies on it for correctness.
- **A wrong username and a wrong password give the same answer, in the same
  time.** The sign-in endpoint cannot be used to find out who has an account.
- **Operators are blocked on the server, not in the browser.** Every endpoint
  calls `requireAuth` or `requireAdmin` and re-reads the role. Editing the
  JavaScript in a console changes what is drawn, not what is allowed.
- **Nothing is hard-deleted.** Corrections are a void plus a re-entry, both
  visible in the sheet and the audit log, so the register can be reconciled
  against what was actually collected.
- **The app is excluded from search engines** by `noindex` headers and
  `robots.txt`. That is tidiness, not security — the real control is that every
  page needs a session.

## What this does not protect against

Worth being honest about:

- Anyone with the owning Google account can read and change the data directly.
- Anyone with access to the Vercel project can read the secrets and deploy code.
- Staff can read every student's fee record; the roles separate *editing* from
  *viewing*, not one class from another.
- A spreadsheet is not an audit-grade ledger. The `AuditLog` tab and Sheets'
  version history together make tampering visible, not impossible.
