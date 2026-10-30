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

Devyn Billiott’s Co-Owner title and one-paragraph biography now come from his submitted questionnaire, as provided by the parent thread. Experience claims are self-reported and have not been independently verified. His verified Drive-rendered WEBP rendition is included without recompression. The partner remains an explicitly unpublished pending slot with no invented identity or credentials. `PublicStaffProfile` includes only approved public content; never derive its title from an authenticated account role. Do not include private email, phone, access level or account identifiers.

## Proposed integration after approval

Add a “Meet the staff” link in the homepage's existing `#about-repformed` section and introduce a dedicated public page. Keep “Meet the Staff” broad enough for owners, coaches, managers and support staff. Production navigation remains untouched in this draft.

Before integration, review Devyn’s photo framing and replace the partner slot with their questionnaire response and approved headshot; verify each experience claim, public title, spelling, photo consent and concise bio with each person. Remove preview-only banner/note only when real profiles are approved. Reuse the component's content contract, retain the semantic headings and responsive grid, then review it in the actual shared site shell. No backend changes are needed for this layout.

## Validation

- TypeScript and ESLint pass.
- Existing unit suite: 35 files, 379 tests pass.
- Normal website build and isolated preview build pass.
- Five Playwright checks pass: 320/390/768/1440px layouts and six-profile growth.
- Axe reports zero violations at all four widths; no horizontal overflow or page errors.
- Phone screenshot visually reviewed; screenshots are local review artifacts, not deployed pages.

## Saved screenshots

- [Phone, 390px](screenshots/phone.png)
- [Desktop, 1440px](screenshots/desktop.png)

These contain preview placeholders only. They are review artifacts, not published staff profiles.

## Devyn profile revision

Uses the exact biography supplied for review, as one paragraph. No repeated experience panel or private contact/account details. The supplied Drive-rendered rendition is integrated; no substitute portrait is used. The partner has no invented name, title or credentials. Nothing is published.

## Approved order

Victor Bennett appears first and Devyn Billiott second in source/reading order at every viewport. Victor’s name and placement were supplied by the user; his title, biography and headshot remain pending. Devyn’s biography is approved. No profiles are published.

## Devyn photo provenance and quality

User authorized copying his uploaded headshot to this repository. The included file is the verified Drive-rendered rendition of that upload, not the original JPEG. Bytes were retrieved from GitHub blob `e400eb1a07b6113ed4c6e5bb7873d9f6f3bfa222`, verified and copied unchanged. WEBP, 1067 × 1600, 87,804 bytes; SHA256 `13e1fb44ff1ef7ed7fb6174b9000eca7cd3aabec22c8bdf32e5dd804bb432aa7`. Library identity supplied by parent: `libfile_a615367c2a6081919bc884b86b990330`, version 0.

Actual pixels were inspected before integration. CSS object-fit preserves proportions; center 56% framing removes excess upper background while retaining face and headset. No AI alteration, sharpening, stretching or recompression. Maximum desktop card width is below the available image width; higher-density screens may reveal the rendition’s native detail limit. Responsive checks verify successful 1067 × 1600 image loading and no CSS enlargement beyond native width. Victor remains first with pending photo and content; Devyn remains second with approved biography. Still no merge or deployment.
