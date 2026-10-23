# Player Development — sample-data prototype

A standalone, responsive virtual player-practice demo, beginning with American football. This project is independent of Coach Workroom and Spawnative; it uses neither their code, brands, accounts, nor hosting.

## Run locally

Use Node.js 24 (see `.nvmrc`) and npm. No account, API key, database, or application environment variables are needed.

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
- Four fictional sample players plus adjustable age, football position, experience, and primary goal. No name or contact information inputs. Every minor profile is parent-managed.
- Today's Training: deterministic matching, age-eligible drills, suggested duration/equipment, explanation, and resumable sessions.
- Ten original illustrative, noncontact practice resources. The youngest group has separate, short, parent-led activities. All age/position/level/goal combinations have a foundational plan; position-specific resources appear when available.
- Guided lessons, ordered practice steps, coaching cues, breaks, next drill, optional reflection, and explicit confirmation of practice. Watching media alone never creates a practice record.
- Combined library filters for search, age, position, experience, and skill; drill detail and age/level/position eligibility checks.
- Per-profile practice history, estimated planned minutes, reflections, reset confirmation, and idempotent recording. Participation is self-reported, not evidence of athletic improvement.
- Coach demo studio: select a file, write instructions, set audience and primary goal, preview matching fictional profiles, and publish once to the local library. Supports MP4/WebM video, PNG/JPEG/WebP, PDF, and plain text, up to 12 MB. Video and images preview; PDFs/text download. No embedded executable HTML/SVG uploads.
- Future package concepts without prices, payments, signup, or promised scholarships/recruiting results. Other sports are future offerings only.

## Storage and prototype limits

Profiles, history, active sessions and published resource metadata use versioned `localStorage`, validated with Zod. Files use IndexedDB. Blob URLs are temporary playback/download references, created when needed and revoked when views close.

Data stays in the current browser and origin. Your partner will see the same built-in samples, **not** your local progress or published resources. Clearing browser site data removes saved content. Private browsing and quota/storage restrictions may prevent persistence; visible error messages explain when changes are temporary or publication fails. Unsaved coach drafts are discarded on navigation or refresh. Sample profile histories are isolated from one another.

No backend, real accounts, admin authorization, actual training assessments, AI coaching, public player profiles, messaging, medical advice, checkout, or real child information is implemented. The open coach editor is deliberately a demo, not a secure admin console. All training content is illustrative and pending qualified coaching review.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium # only if a compatible Chromium is not already installed
npm run test:e2e
```

Playwright uses `/usr/bin/chromium` when present; otherwise its managed Chromium. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select another installed Chromium. The test suite starts Vite automatically. Desktop and phone projects cover onboarding, guardian acknowledgment, every selection control, session steps, pause/resume, refresh persistence, repeated completion, profile isolation, filters, upload cancellation/rejection, matches, publish/retry behavior, media playback, storage errors, destructive-action cancellation, memberships, multiple viewport widths, and automated WCAG A/AA checks. Axe checks do not replace a human accessibility audit.

To test the production server or a deployed website with the same journeys:

```sh
DEMO_BASE_URL=https://your-verified-demo.example npm run test:e2e
```

Tests use fresh isolated browser contexts, create original test media, and only write local browser storage. They do not contact third-party services. Screenshots are generated under `artifacts/`; the HTML report is in `playwright-report/`.

## Free deployment option

GitHub Pages can serve this static prototype without visitor sign-in, if the repository/account is eligible for free Pages. Do not change repository visibility or buy a plan to enable it. The manual `pages.yml` workflow builds and publishes `dist/` after Pages is enabled with **GitHub Actions** as the source. `checks.yml` validates pushes to main and pull requests.

1. Confirm repository eligibility, access, and the desired public exposure of the sample demo. Keep the repository's current visibility.
2. In this repository only, enable Pages with GitHub Actions as the source.
3. Run **Publish sample demo to GitHub Pages**.
4. Verify the workflow's actual `page_url` with an HTTP request and browser checks. A push or successful build alone is not deployment evidence.

The cloud environment's restricted network must permit `api.github.com` for Pages configuration/dispatch and `coachbilliott.github.io` to verify this repository's hosted result. Changes to that access require the user's permission. Existing Git authentication does not by itself prove API/Pages permissions. Do not extract tokens or request secret values in chat.

## Architecture and future sports

`src/model.ts` contains typed profiles/resources, matching, filtering, session records, and persisted-state validation. `src/data.ts` holds original football sample content. `src/storage.ts` isolates persistence and media. `src/Admin.tsx` implements content publishing; `src/components.tsx` contains shared UI/illustrations; `src/App.tsx` connects the user journeys.

The sports registry separates available and future offerings, and resources carry a sport discriminator. Football is the only accepted content sport today. Adding a sport requires a new typed position/skill taxonomy, sport-aware profiles/matching, qualified age-appropriate content, and coverage; it is not falsely advertised as already usable.

## Before a real launch

Qualified review and replacement/approval of all instructional material; validated age and position curricula; licensed coaching media; real parental consent and age handling; privacy/legal and safeguarding review; secure authentication and admin roles; moderated server-backed content/file validation, limits and deletion; account recovery and cross-device storage; human accessibility/device testing; content governance and support; deployment ownership and monitoring. Recruiting/scholarship concepts need separate research and must never guarantee outcomes. Membership scope and pricing remain undecided.

## Originality and dependencies

Copy, field diagrams, layouts, and practice examples were authored for this prototype. System fonts require no external font download. No competitor media, external stock photos, child images, analytics, or third-party video embeds are used. React, Vite, Zod and other open-source dependencies retain their own licenses; Lucide icons are ISC-licensed. See installed dependency license notices. No claim of trademark registration is made for the temporary product name.
