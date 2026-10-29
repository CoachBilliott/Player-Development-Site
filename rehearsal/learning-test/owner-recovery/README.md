# Recover the six fictional test logins

Owner-operated laptop helper. **Prepared and mock-tested; no real reset has been run by this helper.** This is only for the isolated Supabase project `ojcfrfpeftvngyluomex`. It cannot target the live Repformed project.

The helper checks the six existing UUID/email pairs before changing passwords. It updates only passwords through Supabase's documented server-side Auth Admin method. It does not recreate users, replace their history, change roles, send recovery links, create keys or modify project settings.

## On your laptop

Use a private terminal with Node.js 24 (22 or later required). Stop screen recording, terminal recording and screen sharing. Pause any agent/browser screenshots while viewing the existing admin key or entering passwords. Only one person should run the reset.

1. Download this folder, or use Git to obtain the prepared files:

   ```sh
   git clone --depth 1 --branch chore/learning-rehearsal-handoff https://github.com/repformed/Player-Development-Site.git repformed-rehearsal-helper
   cd repformed-rehearsal-helper/rehearsal/learning-test/owner-recovery
   npm ci --ignore-scripts
   npm test
   ```

2. In the **test** Supabase dashboard, confirm the project reference is `ojcfrfpeftvngyluomex`. Inspect Authentication's email/security-notification templates and confirm **Password changed is disabled**. If it is enabled or you cannot verify it, stop. Do not change settings as part of these instructions. The browser verified it off at 01:59 UTC on October 29, 2026; recheck before applying.

3. Prepare six unique replacement passwords in your own password manager, one for each email in `verified-test-users.json`. Each needs 16–64 printable characters, including uppercase, lowercase, number and symbol, without spaces. These stronger requirements are only for this test helper. Do not put them in a text file, command, environment variable, chat or SQL editor.

4. Run the identity check first:

   ```sh
   npm run verify
   ```

   Type the test project reference when asked. Paste the **existing test-project admin key** into the hidden terminal prompt. Use only the existing secret/service-role key from that test project's official API-key settings; do not create a new key, use a production key or paste it into the learning website. The key will not echo. This check lists the six public fictional identities and makes no changes.

5. If all six identities are verified, run:

   ```sh
   npm run recover
   ```

   The helper asks for the test reference and existing key again, then each replacement password twice. Nothing appears while entering the key or passwords. Recheck that Password changed is off immediately before typing the two requested confirmation phrases. Ctrl-C cancels. Once updates start, cancellation cannot undo an already confirmed update.

6. After six confirmed updates, close the terminal. In [the test harness](https://learning-auth-rehearsal.repformed.pages.dev/), enter the matching fictional email and replacement password **yourself**, directly into its normal sign-in form. Never enter the admin key there. When sign-in is complete and the password field is gone, tell the coordinating assistant only which role is signed in. Keep the passwords in your password manager so another role can be signed in without resetting again. Reloading the harness may lose its session.

If the harness cannot load, stop and report that; do not bypass a browser warning. The helper does not enable learning flags or any scheduler, and resetting passwords alone does not finish the learning acceptance tests.

## If anything stops

The helper stops if the project, users, key, passwords or confirmations do not match. It prints sanitized status, never the credential or replacement passwords. Share only the status code and the fictional role, not secrets.

After a timeout or an uncertain update, **do not rerun blindly**. Some passwords may already have changed. Check the saved replacement password using ordinary test-harness sign-in and ask the coordinator to reconcile the confirmed/uncertain account statuses before another reset. There is no automatic retry, reset reversal or account deletion. Preserve all six accounts and their history.

## Boundaries and verification

- Six exact UUID/email pairs are hardcoded and independently checked against the supplied nonsecret allowlist and the server. Unexpected/missing/additional accounts abort the operation.
- HTTPS requests are confined to the test Auth Admin user-list and exact six user endpoints; updates allow a password-only body. Redirects and unrelated endpoints are rejected.
- The existing admin key is broad test-project authority, not a password-only credential. Its safe handling still depends on a trusted laptop, unmodified helper/dependencies and a private terminal. No reusable Codex credential binding is created.
- No credentials are accepted in arguments or files, and the helper writes no result files. JavaScript cannot guarantee cryptographic erasure of memory; process exit discards references. It cannot prevent recording or malware outside the helper.
- No live project, customer, outgoing email, new credential, scheduler or application-permission change is part of this run. Auth can update normal security metadata and invalidate sessions when a password changes; historical learning records are not replaced.

See [VALIDATION.md](VALIDATION.md) for mock coverage and approval evidence.

Official references: [Admin password update](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [API-key authority](https://supabase.com/docs/guides/api/api-keys), [security notification templates](https://supabase.com/docs/guides/auth/auth-email-templates).
