# Meet the Staff — unpublished layout review

Branch: `preview/meet-the-staff`, based on live-main commit `cef1a8c8736e1a8384f2499b3ea15d44716aa7f8`.

## Review locally

- `npx vite --config vite.meet-the-staff.config.ts` → http://127.0.0.1:5177
- `npx vite build --config vite.meet-the-staff.config.ts` → `dist-meet-the-staff/`
- `npx playwright test --config playwright.meet-the-staff.config.ts`
- Screenshots: `artifacts/meet-the-staff/staff-{320,390,768,1440}.png`

This is a separate entry point, excluded from the normal website build. No production routes, navigation, account permissions or backend configuration change. Nothing is deployed. Noindex is an indexing request, not access control; do not host this publicly without separate authorization.

## Design and content

Uses the exact existing `public/brand/repformed-mark.svg`, DM Sans, Barlow Condensed and Option 09 palette. Two profiles stack on phones and form two columns on larger screens. Additional profiles wrap in the same grid. Headshots use a stable crop with face-friendly upper positioning. Profile text stays visible without expansion controls.

All names, titles, bios, experience and photos are explicit review placeholders. No identity, credential or achievement is asserted. `PublicStaffProfile` includes only approved public content; never derive its title from an authenticated account role. Do not include private email, phone, access level or account identifiers.

## Proposed integration after approval

Add a “Meet the staff” link in the homepage's existing `#about-repformed` section and introduce a dedicated public page. Keep “Meet the Staff” broad enough for owners, coaches, managers and support staff. Production navigation remains untouched in this draft.

Before integration, replace fixtures with questionnaire responses and approved headshots; verify each experience claim, public title, spelling, photo consent and concise bio with each person. Remove preview-only banner/note only when real profiles are approved. Reuse the component's content contract, retain the semantic headings and responsive grid, then review it in the actual shared site shell. No backend changes are needed for this layout.

## Validation

- TypeScript and ESLint pass.
- Existing unit suite: 35 files, 379 tests pass.
- Normal website build and isolated preview build pass.
- Five Playwright checks pass: 320/390/768/1440px layouts and six-profile growth.
- Axe reports zero violations at all four widths; no horizontal overflow or page errors.
- Phone screenshot visually reviewed; screenshots are local review artifacts, not deployed pages.
