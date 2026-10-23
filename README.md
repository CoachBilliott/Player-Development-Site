# Player Development — sample-data prototype

A standalone, responsive virtual player-practice demo, beginning with American football. This project is independent of Coach Workroom and Spawnative; it uses neither their code, brands, accounts, nor hosting.

## Private member accounts — connected for an adult pilot

Open [Member access](https://coachbilliott.github.io/Player-Development-Site/#account). The dedicated backend is connected for an invite-only adult pilot. Public registration remains closed; existing pilot accounts can sign in and reset their password. The repository now includes adult signup, email verification/recovery, private parent/adult account setup, private player create/edit/delete, identity isolation and server row-level security. Under-18 enrollment is closed at the database until consent/privacy setup is complete. No demo records are imported. No payment package or price is needed for profile setup.

See [backend setup and current pilot status](backend/SETUP.md). Both initial migrations have been applied to the dedicated owner-controlled project; do not rerun them. Live database privacy checks pass, while inbox delivery and owner activation require confirmation. Do not add real child information in the pilot. Full Auth-login erasure requires the owner; the self-service delete action removes member/profile data only. Real member practice-history syncing and subscriptions remain future work.

## Run locally

Use Node.js 24 (see `.nvmrc`) and npm. No account, API key, database, or application environment variables are needed to run the fictional demo. Real member profiles and shared publishing require backend activation.

```sh
npm ci
npm run dev
```

Open the address printed by Vite on your own computer. To test a production build:

```sh
npm run build
npm run preview
```

The `dist/` folder is a static website with relative asset paths and hash navigation, suitable for a subdirectory on GitHub Pages or another static host. Serve it over HTTP(S); opening `index.html` as a file is not supported by ES modules or browser storage.

## Connected experiences

- Professional homepage and immediate demo entry without sign-in.
- Four fictional sample players plus adjustable age, football position, experience, and primary goal. No name or contact information inputs in the fictional demo. Every minor profile is parent-managed.
- Today's Training: deterministic matching, age-eligible drills, suggested duration/equipment, explanation, and resumable sessions.
- Ten original illustrative, noncontact practice resources. The youngest group has separate, short, parent-led activities. All age/position/level/goal combinations have a foundational plan; position-specific resources appear when available.
- Guided lessons, ordered practice steps, coaching cues, breaks, next drill, optional reflection, and explicit confirmation of practice. Watching media alone never creates a practice record.
- Combined library filters for search, age, position, experience, and skill; drill detail and age/level/position eligibility checks.
- Per-profile practice history, estimated planned minutes, reflections, reset confirmation, and idempotent recording. Participation is self-reported, not evidence of athletic improvement.
- Coach demo studio: select a file, write instructions, set audience and primary goal, preview matching fictional profiles, and publish once to the local library; edit instructions/audience, keep or replace media, and remove resources with confirmation. Supports MP4/WebM video, PNG/JPEG/WebP, PDF, and plain text, up to 12 MB. Video and images preview; PDFs/text download. No embedded executable HTML/SVG uploads.
- Future package concepts without prices, payments, signup, or promised scholarships/recruiting results. Other sports are future offerings only.

## Stadium theme and motion

The field illustration uses SVG and CSS perspective with layered edges, with a route trace, a moving marker, and ambient lighting. Visitors can switch between Footwork and Field Vision, replay the route, or pause visual animation. These are decorative illustrations, not coaching demonstrations or measured player movements. They never create practice records.

The motion control pauses ambient effects, route playback, reveals, and page transitions; its preference lasts for the current browser session. Device `prefers-reduced-motion` is respected automatically, with static visible content and no animated route. Section reveals also show immediately for keyboard focus. The training workflow remains usable when motion is off. Motion-off also disables smooth section scrolling. No automatic movement runs in reduced-motion mode.

## Installable phone app

The `#install` screen explains iPhone/Android home-screen installation. The production build includes an app manifest, original local icons and a scoped service worker. After initial online setup, built-in fictional sessions and local progress can reopen offline. Shared resources, sign-in, uploads and updates require a connection; media may not work offline. Updates require a confirmed reload rather than interrupting training. Installing does not sync browser data. This is an installable web app, not an App Store or Google Play release. See [APP-TESTING.md](APP-TESTING.md) for device steps, update behavior and tests.

## Storage and prototype limits

Profiles, history, active sessions and published resource metadata use versioned `localStorage`, validated with Zod. Files use IndexedDB. Blob URLs are temporary playback/download references, created when needed and revoked when views close.

Data stays in the current browser and origin. Your partner will see the same built-in samples, **not** your local progress or published resources. Clearing browser site data removes saved content. Private browsing and quota/storage restrictions may prevent persistence; visible error messages explain when changes are temporary or publication fails. Unsaved coach drafts are discarded on navigation or refresh. Sample profile histories are isolated from one another.

Shared coach publishing uses the connected backend and an explicit coach allowlist. Its Supabase client, migration and activation checks are described in [backend/SETUP.md](backend/SETUP.md); the owner-supplied Supabase connection is configured and the database privacy checks pass. Real adult pilot accounts are separate from the fictional public demo. Public enrollment and children’s enrollment remain closed pending the documented launch requirements. There are no actual training assessments, AI coaching, public player profiles, messaging, medical advice, checkout, or real child records. The open coach editor is deliberately a demo, not a secure admin console. All training content is illustrative and pending qualified coaching review.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium # only if a compatible Chromium is not already installed
npm run test:e2e
npm run test:app # builds and checks the production service worker
```

Playwright uses its installed, managed Chromium on CI. Locally it prefers `/usr/bin/chromium` when present. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select another installed Chromium. The test suite starts Vite automatically. Desktop and phone projects cover onboarding, guardian acknowledgment, every selection control, session steps, pause/resume, refresh persistence, repeated completion, profile isolation, filters, upload cancellation/rejection, matches, publish/retry behavior, media playback, storage errors, destructive-action cancellation, memberships, multiple viewport widths, interactive route focus/replay, pause persistence, reduced-motion behavior, and automated WCAG A/AA checks. Additional tests exercise real service-worker caching/offline completion/update confirmation, intercepted shared-service publishing across two visitor contexts, and actual PostgreSQL RLS with Auth/Storage schema fixtures. Those fixtures do not replace live-provider acceptance checks after setup. Axe checks do not replace a human accessibility audit.

To test the production server or a deployed website with the same journeys:

```sh
DEMO_BASE_URL=https://your-verified-demo.example npm run test:e2e
npm run test:app # builds and checks the production service worker
```

Tests use fresh isolated browser contexts, original test media, local browser storage, embedded PostgreSQL and intercepted fictional service responses. They do not contact third-party services. Screenshots are generated under `artifacts/`; the HTML report is in `playwright-report/`.

## Published demo and deployment

The public sample-data demo is hosted at https://coachbilliott.github.io/Player-Development-Site/ . This repository uses GitHub Pages' branch publishing: source code lives on `main`; the built static website lives on `gh-pages`. Pages automatically builds and deploys when `gh-pages` is updated. Visitors need no account.

After checks pass, commit source changes and run:

```sh
npm run deploy:pages
```

The publishing script builds `dist/`, uses an isolated temporary Git index, preserves the current source checkout, and pushes a new commit on top of the current remote `gh-pages` branch. It permits only this repository, verifies the pushed ref, and never force-pushes. A dirty source checkout stops publication. No new credentials, API access, or cloud environment publication is needed for this route; it reuses existing Git access.

Check the **pages build and deployment** run in this repository's GitHub Actions page, confirm it succeeded for the published commit, and read the actual deployment URL. An independent HTTP/browser check of the public site is still required when network access permits it. A successful build or push alone is not evidence of a successful live deployment. Network availability depends on the cloud environment. Report any verification limit, and do not bypass the proxy.

`checks.yml` validates source pushes and pull requests. The manual `pages.yml` file is an alternative for repositories configured with GitHub Actions as the Pages source; do not use it to change the current branch publishing configuration. Keep this project separate from unrelated projects and never buy a hosting plan or change repository visibility to deploy the demo.

## Architecture and future sports

`src/model.ts` contains typed profiles/resources, matching, filtering, session records, and persisted-state validation. `src/data.ts` holds original football sample content. `src/storage.ts` isolates persistence and media. `src/accounts.ts` and `src/MemberAccount.tsx` implement private member workflows; `backend/002-private-profiles.sql` enforces member privacy and enrollment rules. `src/Admin.tsx` implements content publishing; `src/components.tsx` contains shared UI/illustrations; `src/App.tsx` connects the user journeys.

The sports registry separates available and future offerings, and resources carry a sport discriminator. Football is the only accepted content sport today. Adding a sport requires a new typed position/skill taxonomy, sport-aware profiles/matching, qualified age-appropriate content, and coverage; it is not falsely advertised as already usable.

## Before a real launch

Qualified review and replacement/approval of all instructional material; validated age and position curricula; licensed coaching media; real parental consent and age handling; privacy/legal and safeguarding review; live authentication/role activation and acceptance; moderated server-backed content/file validation, limits and deletion; live email recovery and cross-device storage validation; human accessibility/device testing; content governance and support; deployment ownership and monitoring. Recruiting/scholarship concepts need separate research and must never guarantee outcomes. Membership scope and pricing remain undecided.

## Originality and dependencies

Copy, field diagrams, layouts, and practice examples were authored for this prototype. Barlow Condensed and DM Sans are served locally with the site under the SIL Open Font License; their notices are bundled with the project. No external font service is contacted. No competitor media, external stock photos, child images, analytics, or third-party video embeds are used. React, Vite, Zod and other open-source dependencies retain their own licenses; Lucide icons are ISC-licensed. The distributed notices are included in `THIRD_PARTY_NOTICES.md` and `public/third-party-notices.txt`; development tools retain additional notices in their installed packages. No claim of trademark registration is made for the temporary product name.
