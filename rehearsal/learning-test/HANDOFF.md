# Test-only browser handoff

Owner-approved target: ojcfrfpeftvngyluomex, existing Repformed starter/Nano Ohio.
EXCLUDED production: iilbulpqbuknhdpmtrvm. No reset/password/key/paid change authorized.
Coding API identity check returned403; no SQL was attempted there and no alternate credential or denied route was tried. Root coordinates the existing owner-signed-in browser task01a17982-e5e1-7575-a6f1-ef9223738023.

1. Open https://supabase.com/dashboard/project/ojcfrfpeftvngyluomex/sql/new and verify the project selector AND URL. The SQL comment/literal is not identity proof.
2. Run00-preflight-read-only.sql; require0public tables/0Authusers/0buckets/0objects/learningfalse and independently check no prior migration history. Stop on any difference; never reset/delete to make it fit.
3. Run the COMPLETE01-empty-test-atomic-install.sql, with no highlighted partial selection. It wraps approved001–012,015–021 (not013/014) in one transaction, sourced verbatim except outer transaction wrappers from green59ac534. The embedded guard rejects existing public tables/users/buckets/objects/history; the browser still must verify exactproject. Any SQL error: stop, rollback any aborted transaction if still open, inspect; do not blindly rerun or reset.
4. Run02-postflight-read-only.sql. Local compile expected59publictables/18learningtables;0Authusers/0Storageobjects;2privatebuckets;alllearning/youth/email/intake/monitoring flagsfalse; no authenticatedtick/rawkeyaccess. Record actual hosted results, not this local expectation.
5. Do not deploy EdgeFunctions, import productiondata, set SMTP/Resend, activate scheduler or forward a public app to this project. No generated access keys/password resets. No real people or children.

Source manifest gives exact19file hashes and stable existing rawGitHub URLs at59ac534a47816b83473795aa372ba34298539dd0. Bundle local validation is PostgreSQL/PGlite only: installation + nonempty rerun refusal passed; not hostedAuth/Storage acceptance.

Real Auth/Storage acceptance is now owner-approved for up to six disposable fictional Auth accounts with temporary passwords in this test project only. See AUTH-ACCEPTANCE.md for exact approval evidence and execution boundaries. Passwords must never appear in chat, logs, screenshots, SQL history or artifacts; hold them only in secure temporary test memory. No outbound email. No privileged API key creation, production credentials or broader access are approved. Normal user JWTs must exercise client-facing checks; administrator context is only for approved test setup/cleanup. Existing automatically provisioned public test API key is nonsecret.

After schema stage: isolated SQL transactions can test role/claim policies, scoring/version/history, scheduler dry-runs and rollback with synthetic fixtures thenROLLBACK. These are NOT proof of real Auth login/JWT verification, Storage uploads/signing or provider Cron. Keep actual scheduler and notices off outside rolled-back tests.

Production remains greenf1e9812, source59ac534, draftPR12/13unmerged. Production recovery/019–021permission/retention/scheduleractivation approvals remain separate.
