# Future Elite review readiness — source preparation only

2026-10-27. Proposed package: two reviews per month, up to three minutes of footage per review, written feedback, target three business days (not guaranteed). These terms are proposals and do not change current pilot service limits or create paid credits.

## Verified existing implementation

- Current production: one clip up to 60 seconds, 40 MiB; five stored clip/reservation spaces per adult account. Manual review access is separate from billing; the current review target is 48 consecutive hours.
- Draft 013/014 source already supports one request containing up to three 60-second clips, maximum 180 seconds total, existing account storage caps, stable request/clip IDs, partial-upload retry and one deadline/feedback response. Those migrations are NOT installed or enabled in production.
- The existing grouped source still contains the older four-review example. It must not be interpreted as the new package allowance.
- Existing delete actions explicitly remove the media AND associated written feedback. Therefore retained written history after media removal is not implemented. Do not promise it as an active service.
- Media duration is browser-reported/declared metadata; there is no independent server-side duration measurement. A production-ready plan needs a reviewed validation strategy without pretending client metadata is verification.

## Minimal next source slice

1. Keep grouped creation off and preserve the current 60-second per-clip limit; reuse the existing three-clip/180-second implementation rather than permitting a new 180-second single-file upload.
2. Remove obsolete fixed monthly-count examples; present clip capacity separately from monthly package entitlement. Validate selection against available storage without raising quotas or automatically deleting anything.
3. Prepare written-feedback storage independently from video rows, with separate explicit media removal versus full review/account erasure. Preserve current authorized household/assigned-review-coach scope, closure freezes and account erasure; no new global staff feedback visibility. No production migration until exact retention, access and erasure behavior is approved and tested.
4. Proposed two-per-month allowance needs a server-authoritative, per-athlete, versioned entitlement/usage ledger with idempotent submission. Package period boundaries, rollover, cancellation/refund and partial-month handling are not final. A client counter or five storage spaces is not payment proof or monthly entitlement.
5. Three-business-day target requires a confirmed business timezone, weekend/holiday definition and clock-start policy before replacing the current 48-hour target. No scheduler/email activation is implied.

## Capacity and retention decision needed

Two fully retained three-clip reviews require six clip spaces; the current account cap is five (shared across siblings). More purchases do not automatically add storage. Options require explicit approval: a storage quota change with cost/abuse review, or owner-directed media cleanup after delivery while retaining separately protected written feedback for an agreed period. Automatic deletion, unlimited uploads and indefinite retention are not assumed.

## Release gates (not executed)

Coordinated review of draft schema/access/deletion behavior; isolated synthetic migration and authorization tests; real iPhone camera/library/retry/playback acceptance; approved package/billing terms, reliable email sender and reviewed coaching content. Do not apply grouped 014 merely to ship the public proposal page. No new paid service, credential, production security change or child enrollment.
