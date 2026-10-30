# Meet the Staff — production integration awaiting release handoff

Branch: `preview/meet-the-staff`, rebased onto `9b8caac` on main (approved field/offline image work included). Account-names PR #32 is not included. The user authorized adding both supplied photographs/bios and publishing; the original release owner coordinates merge and production deployment after checks. This worktree does not deploy.

## Public behavior

`#staff` renders Victor Bennett (Owner) first, then Devyn Billiott (Co-Owner), in source/read order on every viewport. Access from main/mobile website navigation, the homepage's existing About Repformed section, and footer. Shared site shell supplies the existing official logo, fonts, navigation and footer. Option 09 colors and a two-column desktop/single-column phone grid are retained. Both biographies are one paragraph, using the exact concise copy supplied and approved through the parent conversation. No questionnaire, preview banner, placeholder, duplicate experience panel or private contact details appear on the public page.

Public titles are content only and do not grant or modify account roles. No backend, enrollment, account settings or permission changes. Self-reported experience comes from the actual submitted forms, not independent credential verification. Victor's biography says more than 20 years developing young athletes; it does not claim 25 years coaching or guaranteed outcomes. No school endorsement is asserted.

## Photo provenance and quality

Both photo-to-repository copies were explicitly approved by the user. Exact supplied bytes are preserved without AI alteration, stretching, sharpening or recompression. Actual source pixels were visually inspected before placement. CSS `object-fit: cover` preserves proportions, with separate positions for each portrait: Victor center 15%, Devyn center 56%. The maximum card width is below both native image widths. Photographs join the approved static public shell cache so staff content is complete offline; no private uploads/API records are cached.

- Victor: exact JPEG, 942 × 1536, 245,413 bytes. GitHub blob `b1b2b997125bb161acc963499cda95c57d71ebac`; SHA256 `e06cf73e6782e287a0e7fbf90f1d78073f7b9292c0c57e7268a3f6a253e41c47`. Supplied Library identity `libfile_2fa7c80fdb6c8191834aa57f24f7df6c`, version 0.
- Devyn: verified Drive-rendered WEBP rendition of his uploaded JPEG, 1067 × 1600, 87,804 bytes. GitHub blob `e400eb1a07b6113ed4c6e5bb7873d9f6f3bfa222`; SHA256 `13e1fb44ff1ef7ed7fb6174b9000eca7cd3aabec22c8bdf32e5dd804bb432aa7`. Supplied Library identity `libfile_a615367c2a6081919bc884b86b990330`, version 0. This is not represented as the original JPEG.

## Review and validation

- Website: `npm run dev` → `http://127.0.0.1:5173/#staff`
- Build: `npm run build`
- Focused browser checks: `npx playwright test tests/meet-the-staff.spec.ts`
- Isolated internal review entry: `npx vite --config vite.meet-the-staff.config.ts`. Only that isolated wrapper labels itself unpublished. Its page component and staff data are shared with production; no duplicate biographies.
- Full production screenshot artifacts: `artifacts/meet-the-staff/production-{320,390,768,1024,1440}.png`
- Saved [phone](screenshots/phone.png) and [desktop](screenshots/desktop.png) images show the actual integrated site.

Before release, the release owner should reconcile any newer main changes, review the final screenshots and CI, merge through normal repository gates, and deploy once. This document is not a claim of production publication.

## Completed checks for release handoff

- Full TypeScript and ESLint pass; 35 unit files / 379 tests pass; 11 Python script tests pass.
- Production and isolated builds pass (existing bundle-size warning remains).
- Production staff + mobile-app regression run: 16/16 pass, covering five widths (320/390/768/1024/1440), both profiles/photos, route focus, navigation/footer/About links, no placeholder copy, and axe WCAG checks.
- Homepage/package, Contact and approved-field regression checks pass on desktop and phone. Initial browser-output folder collision was corrected by giving the isolated suite its own output directory; affected mobile tests and the corrected mobile-nav assertion were rerun successfully.
- Isolated preview suite: 5/5 pass, including six-profile growth.
- Built production offline reload verified both profiles and both photos available after service-worker activation.
- Final phone and desktop screenshots visually inspected: complete photos, readable bios and official site branding.
