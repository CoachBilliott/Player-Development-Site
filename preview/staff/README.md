# Isolated client-service preview

This entry point renders the real `StaffServiceDashboard` against an in-memory
fictional adapter. It does not initialize Supabase, load production configuration,
send notifications, accept credentials or persist changes. Role selection is a
demonstration, not authentication or evidence of production authorization.

- Run: `npx vite --config vite.staff-preview.config.ts`
- Validate: `npm run typecheck && npm run lint && npm run test:staff-preview`
- Build only this preview: `npm run build:staff-preview`

Output is `dist-staff-preview`, separate from the website's `dist`. Public assets
are restricted to the original brand mark and security/noindex headers. All
fonts/scripts/styles are local; the built page disallows external API connections.
The page is publicly accessible when deployed; noindex is not access control.

Publish only to a **non-production** Pages branch, never `main`. Use the existing
approved project/account and inspect the returned deployment environment. No
production database or dashboard feature flag is required. Verify production's
canonical deployment remains unchanged. This is not a native/TestFlight release.

The preview resets on refresh. Existing screenshot validation and backend policy
tests are documented in `docs/staff-service-preview/README.md`; this standalone
preview additionally tests role switching, detail/back navigation, assignment,
reset, refresh, mobile overflow, accessibility and zero external API requests.
