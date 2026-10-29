# Owner-operated test recovery validation

Preparation only, October 29, 2026. No real admin credential was read, no live request was made by the helper, and no account password was changed during these checks.

## Scope and evidence

Fixed target: test project `ojcfrfpeftvngyluomex`. Production `iilbulpqbuknhdpmtrvm` is excluded. Exact six UUID/email pairs are in `verified-test-users.json` and independently hardcoded in the executable. The owner-signed-in browser worker supplied these pairs and reported the test project's Password changed security notification **disabled at 01:59 UTC on October 29, 2026**. This is an observation, not a guarantee about later settings. Applying requires a fresh owner UI check and explicit attestation; the helper never fetches bulk Auth configuration or changes the setting.

The owner previously approved temporary use of the existing test-project admin credential for only these six fictional users:

> Assistant, October 29, 2026, 01:48 UTC: “May I temporarily use the existing test-project admin credential to reset only those six fictional accounts? It has broad access to the test database, so I need your specific approval. It would stay server-side, with no new key, production changes or emails.”
>
> Owner: “Yes”

The coordinating task then requested preparation of an owner-operated helper, without execution or secret access. This deliverable does not itself exercise that reset approval. No credential transfer to the agent or reusable environment binding was established.

## Completed checks

- `npm ci --ignore-scripts --no-audit --no-fund`: passed against the standalone pinned lockfile; no app dependencies/configuration changed.
- `node --check recover-test-users.mjs`: passed.
- `npm test`: **11 passed, 0 failed**. All provider responses and passwords were synthetic in memory; no hosted service was called.
- CLI help and non-TTY rejection checked without credentials.

Coverage includes exact UUID/email scope, wrong/extra/missing identities, production/public/user key rejection, fixed HTTPS host, allowed methods and password-only request bodies, redirect rejection, default read-only operation, notification-off and final confirmation gates, unique/matching replacement passwords, cancellation, six successful mock updates, uncertain-result stop without retries or secret logging, hidden input and raw-mode cleanup. An integration test uses the pinned real Supabase SDK with a fake fetch transport, covering missing pagination headers and a failed update with exactly one mutation attempt.

No real laptop TTY, admin authority, password reset, security-email suppression, restored login or subsequent learning acceptance is claimed tested. Transport/TTY mock tests cannot detect external recording, malware, provider behavior or changed dashboard settings. The helper uses normal TLS verification; no proxy/access restriction is bypassed.

## Following owner execution

Keep the six UUIDs and all test history. Do not recreate accounts. The owner enters saved replacement passwords directly into the isolated harness; never into agent messages or automation arguments. Resume ordinary user-session acceptance only after the password field is gone. Quiz import, enrollment, scoring/manual grading, sibling/guardian/coach isolation, private file access and historical-version checks remain to be completed. Learning flags stay off until the separately approved test procedure enables only the needed test scope. No standing scheduler or outgoing email is activated here.

This artifact-only branch does not change the production application, PR12/13, the hosted test harness or TestFlight build 13. It requires no production release or full application CI rerun.
