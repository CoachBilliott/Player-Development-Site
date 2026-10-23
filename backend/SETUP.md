# Shared coach publishing — prepared, not activated

The website is live. The default `public/content-config.json` disables shared publishing. This repository contains a working client integration, a reviewable PostgreSQL migration and tests using simulated service APIs. **No Supabase project, coach account, credential or live security policy has been created or changed.**

The local editor is available now at `#coach`; it saves in the current browser. Shared publishing cannot work until the following account and service setup is approved and completed. The suggested route is a separate Supabase project on an available free plan; verify current limits and terms before creating it. Never enable billing or buy a plan automatically.

## Prepared implementation

- Invite-only adult coach email/password sign-in; no player signup.
- Database coach allowlist and row-level security; browser roles cannot grant themselves membership.
- Public reads restricted to published sample resources and their media.
- Private media bucket, 12 MB file limit, explicit MIME allowlist, short-lived signed reading links (one hour).
- Upload, publish, edit, file replacement and removal in the shared studio.
- Server-managed resource versions prevent silently overwriting another coach's changes.
- Stable draft IDs and checks after ambiguous responses limit duplicate publication.
- Local and shared destinations are clearly separated; switching asks before discarding unsaved work.
- Player preferences and practice history remain fictional and browser-local.

## Activation steps, after owner approval

1. Create a project dedicated to Player Development in the owner's Supabase account. Do not reuse Coach Workroom, Spawnative, or another project's storage, database or credentials. Review free-plan storage, bandwidth, inactivity and email limits.
2. Review and run `001-shared-content.sql` once against that new project. It creates `coach_members`, `training_resources`, a private `training-media` bucket and policies. Do not run it against a database with unrelated content. Keep a copy of the migration and its output.
3. Disable public user signup for this invite-only coach pilot. Provision adult coach accounts for the owner and partner through the provider dashboard. Set/deliver passwords through the provider's secure account flow, never in repository files, public uploads or chat. Configure the intended website URL and any recovery/redirect settings before using an invitation or password-recovery flow.
4. Add only those users' Auth UUIDs to `public.coach_members` through the privileged provider dashboard. Example with a placeholder that must be replaced: `insert into public.coach_members(user_id) values ('APPROVED-COACH-AUTH-UUID');`. There is deliberately no public website button for granting roles.
5. Put only the project's HTTPS URL and **public publishable key** (or legacy anon key) in `public/content-config.json`, and set `enabled` to `true`. These fields will be public. Never use a secret key, service-role key, database password or personal access token. The client rejects known secret/service-role key formats. No service-role key is needed in the website.
6. Run the checks and deploy the configuration through the existing project-specific Pages route. If the cloud network blocks the new project's hostname, use the supported approval/configuration workflow for that exact hostname; do not bypass the proxy or TLS verification.
7. Test the actual service before claiming shared publishing is ready: an approved coach signs in, uploads original fictional sample media, publishes, edits and removes it; the partner's separate browser sees each published change after refresh. Sign out and confirm visitors retain read-only access. Test a separate non-coach account and anonymous API attempts to write resources, upload private objects or grant membership; all must fail. Verify unlisted/draft resources and unrelated bucket objects are unreadable, stale edit versions are rejected, file-size/type limits are enforced and removal cleans up media.
8. Use Safari on a real iPhone and Chrome on a real Android device for uploading, video playback, installing the web app, connection loss, refresh persistence and app updates. Automated Chromium phone emulation does not replace physical-device checks.

## What has and has not been verified

The database migration is executed in local embedded PostgreSQL tests with minimal Auth and Storage schema fixtures. These tests exercise actual PostgreSQL role permissions, row-level security, constraints and update versions. Browser tests exercise the real client SDK with intercepted, fictional Auth/Storage/REST responses, including a second visitor context. They do **not** prove that an uncreated live project's Auth, Storage, email, CORS or settings work. Live acceptance checks are still required after connection.

Storage's size/MIME limits and database validation are implemented. Full file-content inspection, malware scanning/moderation and production content governance are not implemented; use controlled, original sample files only. Media links expire after an hour and can require a page refresh. If a request cannot be confirmed or orphan-file cleanup fails, the editor preserves the draft or reports the cleanup requirement; the owner should audit storage. The pilot has no player accounts, cross-device player history, payments, messaging or public player profiles.

Before a real-player release, complete coach recovery and support procedures, monitoring and backup/restore checks, server-side content inspection, qualified curriculum/media review, parental consent/privacy/deletion requirements and human accessibility/device testing.
