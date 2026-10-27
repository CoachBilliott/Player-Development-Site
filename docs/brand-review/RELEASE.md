# Repformed integrated release

This combines main `0185525`, the reviewed option-09 brand source from
`b5f103d`, and the account-lifecycle source changes from migration PR #1
`6cfebfe`. It preserves the single public customer demo, one shared login,
private server-enforced roles, Contact and authored Quick Help. No live
database migration, Auth configuration change or new paid service is included.

## Product changes

- Repformed's black, gold, ivory and steel identity spans the public website,
  shared training app, icons and help pages.
- App website/help links resolve at `https://repformed.com/`. The URL guard
  permits that exact HTTPS origin and rejects external or credential-bearing
  URLs. It no longer requires the GitHub Pages subdirectory.
- Five verified profiles are shared from `public/social-links.json`: Instagram,
  TikTok, Facebook, X and YouTube. The first four were checked through the
  Owner's signed-in account controls. YouTube's public `@repformed` channel
  was verified for website linking; that does not establish upload access.
- Contact remains in the public desktop/mobile navigation and footer, with
  `Repformed@gmail.com`. App Help and the online guides share the links.
- The illustrated walkthrough/PDF uses the production domain, Repformed
  identity and a contact/social reference page. Earlier fictional screenshots
  are explicitly marked as historical browser previews.
- The GitHub fallback publisher checks a stable application identifier instead
  of the retired public name. It remains restricted to this repository and
  never becomes the Cloudflare production publishing route.

## Exact copy cleanup

- Hero: “Free sample-data demo. No account needed.” becomes “Free demo. No
  account needed.” The actual demo still identifies fictional sample data.
- Removed the hero's “Licensed stock footage · Not a coaching lesson” caption,
  the two-photo section's stock/member disclaimer, and the field-image caption.
  Full source/license credits remain available through **Credits & licenses**
  in the footer. Image alt text and functional accessibility labels remain.
- Removed the footer's repeated qualified-review and scholarship/outcome
  disclaimers. It now contains the copyright and Credits & licenses link.
- Replaced the long homepage ending disclaimer with “Public signup and junior
  enrollment are not open yet. Explore the demo with fictional profiles.”
- Removed the membership page's speculative scholarship/recruiting section.
  Memberships still explicitly state that purchasing/billing/enrollment are
  unavailable. No guarantee or new service promise replaces the removed copy.
- The public top strip says “Early access” instead of “Invite-only pilot.”
  Account screens still enforce and explain invitation-only access.

Training acknowledgements, qualified-review warnings in actual practice flows,
private media/consent restrictions, payment status, no-AI claims and legal/
privacy commitments are preserved. Pexels attribution was consolidated under
its permitted license; the original full credits and software notices remain.

## Native source and release boundary

The native display name and Capacitor background are updated to Repformed.
`scripts/render-native-brand.mjs` exports the approved SVG identity into an
opaque RGB 1024×1024 iOS icon and three 2732×2732 launch images. Dimensions,
opaque PNG color format and Info.plist display name were checked. The existing
bundle ID, Apple team, signing configuration and user data identifiers remain.

These source changes do not update installed iPhone apps. Native compilation,
simulator/physical-device acceptance and TestFlight distribution remain a
separate release. No Apple build upload is implied by website publication.

## Validation and publishing evidence

Required checks are lint, TypeScript/build, all Vitest cases (including embedded
PostgreSQL authorization checks), Python script checks, Deno account-lifecycle
checking, the complete desktop/phone Playwright suite without retries, and the
production PWA/offline suite. Regression cases cover production-origin session
verification, safe app link handoff, build identity and all five official social
links across the website, app help, guides and Credits page. Final executed
results and the tested revision are recorded in the release PR's checks/body.

Publication is manual, to the existing Cloudflare account/project only, after
the requested review/merge and passing checks. Source pushes do not publish
production. Confirm the remote main revision, deployment ID/commit/status and
actual served content. The cloud worker previously received HTTP 403/error 1010
for production page requests; if that restriction persists, independent browser
verification is required and must be reported separately from API deployment
success. Never bypass that restriction or present a GitHub fallback release as
Repformed production.
