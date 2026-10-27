# Repformed brand review

This branch starts at `0185525` on main, retaining the one-platform homepage,
Contact page, approved-answer Quick Help, shared official social-link slots and
private account workflows. It is a review build, not a production release.

## Approved direction

Option 09: black `#181818`, warm gold `#C7A45C`, ivory `#FAF5EA`, steel `#8C939D`.
The reference was materialized from Library item
`libfile_46cc6a6f28348191bfba65e9c224e041`, verified readable and visually inspected.
Only option 09 was used. The SVG mark follows its angular forward R silhouette,
with the main body in gold and the separate left stem in steel. The live lockup
uses an ivory REPFORMED wordmark and ATHLETE DEVELOPMENT subtitle.

The theme combines a photographic hero, metallic button surfaces, steel rules,
gold detailing, ivory editorial sections and restrained shadows. The shared
app uses the same palette, with its existing compact navigation and private
workspaces. Focus indicators and reduced-motion behavior remain explicit.

## Files and reproduction

- `src/repformed.css`: shared visual identity and responsive refinements.
- `public/brand/repformed-mark.svg`: scalable two-color R.
- `public/icons/source.svg`: canonical PWA icon; the PNG variants are rasterized
  from this SVG at their declared dimensions. The maskable mark stays inside
  the central safe area.
- `build/pwa.ts`: the mark joins the versioned offline app shell; no account
  data or media uploads are cached.
- `scripts/capture-brand.mjs`: with the local dev server running, execute
  `node scripts/capture-brand.mjs`. It disables the backend, uses reduced motion,
  loads photographs and saves desktop, phone and 320px app captures under
  `artifacts/repformed`. It rejects horizontal overflow.

Existing pricing, permissions, account safeguards, backend configuration,
storage identifiers, native bundle identity and outbound origin checks are
unchanged. Official social URLs remain in their existing shared configuration;
none were guessed or duplicated. Customer-facing app strings now say Repformed.

## Release coordination

Do not merge or deploy this review branch without release coordination.
Migration PR #1 (`6cfebfe2d1ffc52722c1711de0af8b37f61079a5`) is separate and must
retain its backend-origin and invitation changes when the branches are combined.
This brand branch does not replace that work.

Production is the Repformed Cloudflare Pages Direct Upload project `repformed`
at `https://repformed.com/`. `deploy:pages` publishes the GitHub Pages fallback;
it must not be used as a production release command. No deployment credentials
were configured here.

The local integration adds production app links, native display name/icon/splash
catalog exports, five verified social links and the separate backend migration
source. Native iPhone compilation, TestFlight/App Store distribution,
physical-device acceptance and social banner/profile publication remain separate.
Existing installed binaries have not changed. The illustrated partner guide,
its PDFs and build-10 screenshots remain historical snapshots and should be
refreshed alongside the coordinated native release; they have not been relabeled
to imply that a new iPhone binary exists.
