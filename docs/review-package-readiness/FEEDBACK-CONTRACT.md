# Retained written feedback: proposed contract, not implemented

This describes the next schema review; it does not install a migration or change
current deletion/retention behavior. Draft grouped migration 014 is not a safe
substitute: it clears group_feedback when media/review records are erased.

- A delivered written-feedback revision should belong to one review request and
  exact athlete/household. Store the original text, author reference, delivered
  timestamp and revision/deduplication key independently of video object rows.
  Do not parse the existing free-text response into invented strengths/corrections.
- Media references may become unavailable without erasing an authorized written
  record. Never retain playable copied media URLs as proof of continuing access.
- Reading feedback still requires the owning authorized adult/guardian or the
  explicitly assigned review coach, with verified account, closure and revocation
  checks. A service-roster assignment alone must not grant private feedback.
  Owner/Manager service metadata visibility is not a blanket new media grant.
- Separate two explicit actions: remove media while retaining protected feedback,
  and erase the entire review including feedback. Existing delete buttons must
  keep their currently promised full-delete semantics until a coordinated change.
  Full account erasure must cover the independent feedback records too.
- Before implementing any active retention, approve the period, account-closure
  handling, guardian-access expiry and supported export/erasure responsibilities.
  No indefinite retention or automatic media deletion is assumed.
- Saving feedback should be atomic and version checked; retrying the same delivery
  must not create another monthly usage entry or duplicate notice. Partial media
  cleanup cannot silently erase the written record or report full deletion.
- Rehearse wrong-household/wrong-sibling reads, unassigned/revoked coach reads,
  account closure, copied identifiers, media-only removal, full erasure, repeated
  saves/deletions and interrupted cleanup. Keep raw archive tables private; expose
  only narrowly scoped APIs. Do not enable future junior access in this rollout.

This change needs reviewed draft SQL plus local authorization/deletion tests,
backup/restore readiness and separate live-migration approval. The current source
slice only improves selection validation/capacity wording; it does not yet create
this archive, monthly billing entitlements or a business-day scheduler.
