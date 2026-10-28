# Disposable Auth acceptance: exact owner approval

Target: test project `ojcfrfpeftvngyluomex` only. Production `iilbulpqbuknhdpmtrvm` is excluded.

The following authorization was forwarded unchanged by the coordinating task:

> Assistant Sentinel_6a09744438548191a6d8f7e5b348e6e0: 'One additional approval is needed for realistic login testing: may I create up to six disposable fictional test accounts with temporary passwords only in the test project? This lets me verify that athletes, guardians and coaches can’t access each other’s private content. No real customers, emails or production accounts would be affected.'
> User Sentinel_c1b3c2de511c81919ef14f2f7257a7cd Oct28 22:48UTC: 'yes'

This authorizes temporary test-user login credentials; it does NOT authorize new privileged API keys, production credential access, broader scopes, real customer changes, password resets or outgoing email.

## Execution boundaries

- Verify exact project URL/header before setup, each mutation phase and cleanup. Rerun emptiness checks before schema installation; if state differs, stop and inspect. Never reset or delete an unfamiliar record.
- At most six reserved fictional addresses, such as `repformed-learning-owner@example.test`, manager, assigned coach, other coach, parent and other parent. The six accounts can support multiple fictional adult athlete profiles/siblings in two households. No real child information. If a linked-athlete login scenario needs a distinct role, reuse one of these six identities in a documented later phase; do not create a seventh account.
- Create test identities without sending invitations/verification/recovery emails. Keep actual SMTP/function/dispatcher/cron off. Seed only test-user role/profile relations through the authorized owner context.
- Generate high-entropy temporary passwords in secure test-process/browser memory. Never return them from browser evaluation, print request bodies, store them in files/SQL history, commit them, paste them into chat, save them in the browser password manager, or capture filled credential fields. Suppress/redact auth response tokens too. Report only non-secret IDs, statuses and assertions.
- Use the existing public test publishable/anon key where required, and ordinary signed-in user JWTs for all learner/coach API assertions. Never create/extract a privileged key or use administrator credentials to claim an RLS denial passed. Administrative owner context is limited to setup/cleanup.
- Check successful and failed real login, anonymous and cross-household/profile/coach denial, assignment revocation, protected quiz keys/server grading/history, actual private sample upload/read/signing and access after withdrawal. Record signed-URL TTL honestly; a previously issued URL may remain valid until expiry.
- Sunday/Friday/DST/idempotency/rollback tests must use isolated transactions or explicit test-clock dry-runs. Do not install a standing Cron job, open public junior enrollment or leave activation flags enabled outside the approved test phase. Existing SQL role/claim simulation is supplementary, not real Auth/JWT proof.
- Remove only the exact recorded synthetic users/files/rows on completion, then confirm counts and all activation flags. Preserve schema for review. No destructive database reset. If current approved browser tools cannot hold credentials securely or cannot administer Auth without a new privileged credential, stop that phase and report the exact blocker.

No Auth accounts or Storage files have been created by this handoff publication.
