# Grouped drill reviews — unpublished implementation and review draft

## Current implementation checkpoint

Migration draft 014 and the customer/assigned-coach screens now implement atomic
clip reservation, interrupted-upload retry, one final submission/deadline, one
feedback response and explicit deletion. New-group creation defaults OFF. No
production migration or capability activation has occurred. The earlier design
below records the intended contract; its implementation-status paragraphs are
superseded by this checkpoint. Local validation: 269 unit tests, 32 affected browser
cases, lint, types and build passed. Full hosted/native acceptance is outstanding.

The owners are currently finalizing packages. Earlier review prices/inclusions
below are planning context and can be superseded by their final decisions. They
are not activated financial or entitlement rules.

## Recorded service terms

- One drill review may contain **one to three clips of the same athlete and drill**.
- Each clip remains at most **60 seconds**; the combined review is at most **180 seconds**.
- Recorded pricing: **$15 one review**, or **$45 monthly with four reviews per child**.
- A review is one fulfillment unit, regardless of whether it has one, two or three clips.
- The monthly charge's per-child versus household coverage, credit-cycle/expiry,
  cancellation/refund and failed-payment terms still need resolution. The four-review
  allowance and three-minute total do not need to be decided again.

Nothing here activates payment, credits, real child media or increased storage.

## What is prepared, and what is not

`backend/013-preview-review-groups.sql` is a **read-only, uninstalled preflight draft**
after migration 012. It validates the proposed clip manifest using the actual database
authorization functions, audience rules, declared duration/size and existing capacity.
Its response explicitly says `preview_only=true`,
`grouped_submission_available=false` and `monthly_credits_active=false`.
Repeated previews create no files, upload reservations, service requests, clocks,
credit entries or charges. Capacity is a snapshot, not a reservation or a promise
that a later upload will fit.

The current pilot still accepts **one clip of at most 60 seconds per review**.
The customer UI states that limit and describes storage separately from monthly
reviews. It does not expose a three-clip upload button. The preflight is not called
by the current customer flow, and applying it alone would not enable grouped reviews.

**Still to implement before enabling groups:** durable grouped requests, upload
recovery, atomic submission, group-aware coach access/feedback, grouped history and
deletion behavior, capability rollout and actual device/media acceptance. This is
separate schema and workflow work beyond migration 012; it is not a completed
grouped fulfillment feature.

## Proposed durable schema and lifecycle

Reuse the existing private media bucket and clip rows. Do not create a second upload
system or reinterpret the five-clip cap as review credits.

1. Extend `review_services` with a grouped-request marker, a fixed manifest/revision,
   planned clip count, explicit submission timestamp and one final feedback record.
2. Add a nullable `review_request_id` and bounded ordinal (1–3) to
   `athlete_video_reviews`, with a unique `(review_request_id, ordinal)` constraint.
   Null preserves legacy one-clip requests. All grouped clips must belong to the
   service's account, profile and drill. Browser table writes remain revoked.
3. Create the request before uploading. Checked RPCs reserve stable clip IDs under
   its manifest; repeated clicks and lost responses reuse the same IDs. A completed
   clip is never overwritten. Cancellation and failed cleanup remain retryable.
4. Update the existing video/service synchronization trigger before accepting grouped
   clips. Otherwise migration 011 would incorrectly create separate services and
   start a clock for each upload. Do not merge already-delivered or already-assigned
   legacy services into a newly purchased review.
5. Final submission checks all declared files are present, playable/verified,
   authorized, within aggregate limits and approved where approval is required.
   Start **one fixed 48-hour deadline** only then. Partial uploads start no clock.
6. Assigned coach access covers exactly this ready group's clips. Operational staff
   metadata access does not automatically grant clip/profile access. Save one final
   feedback response to fulfill one review; opening a clip or completing playback
   is not fulfillment. Update old per-clip feedback/start RPCs so they cannot mark
   a group delivered after just one clip.
7. Preserve the original deadline across refresh, retry and reassignment. A missing
   or deleted clip after submission flags follow-up; it must not silently reset the
   deadline or imply the whole group was delivered. Customer-caused resubmission
   policy needs to be settled before charging.
8. Keep paid entitlement accounting separate. A future ledger is keyed by athlete,
   billing period and unique review request. It may debit once at accepted final
   submission, never once per file, preview, retry or failed upload. No ledger or
   paid balance is enabled by this draft.

No junior upload gate changes are included. Under-18 media still needs the separately
reviewed consent, retention and age-transition process. Existing parent pause,
revocation, account deletion freezes and cross-household isolation remain mandatory.

The preflight validates **declared metadata**, not independently measured media.
The present pipeline does not establish trustworthy server-measured duration simply
because a browser reports it. The final grouped path needs an agreed verification
or processing step, or explicit staff verification before acceptance. No new media
service or credential has been created.

## Storage and retention are separate decisions

Current safeguards stay unchanged:

| Safeguard | Current value |
| --- | --- |
| Stored clip/reservation count | 5 across the account's athletes |
| Maximum file | 40 MiB per clip |
| Shared declared review-media budget | 300 MiB across private clip reservations in this project |
| Automatic media deletion | None; clips remain until deleted |
| Written feedback after clip deletion | Currently removed with the clip's review record |

A full three-clip group uses three storage spaces, leaving two in an empty account.
Four three-clip reviews produce **12 files**, not four. At today's maximum file size,
that is **480 MiB per child per billing period**, already beyond the entire shared
300-MiB budget. Do not advertise an archive of all monthly submissions under the
current cap. The API returns only the caller's account capacity and a global-capacity
boolean; it does not disclose another household's usage.

This application guard covers private review media. It is not the hosting provider's
overall quota; training assets, other data and backups need separate usage checks.
No provider plan, storage allowance or billing setting has been changed.

| Proposal for owner review | Benefit | Tradeoff / required work |
| --- | --- | --- |
| Keep the current cap during the adult pilot | No silent quota, retention or cost change | A second full group may not fit; deletion currently removes attached feedback. This is not a sufficient paid monthly archive. |
| Finite compressed-file cap plus an approved media window | Predictable storage and room for recent reviews | Compression and a strict server cap must be tested; a proposed 14- or 30-day window needs notice, export/deletion rules and a cleanup worker. No window is currently active. |
| Finite per-athlete archive and approved project budget | More history and less frequent manual deletion | Requires capacity/cost approval, enforced quotas and retention rules. Never promise unlimited storage or silently upgrade a plan. |

Example planning math, **not an implemented cap or price**: at a strict 12-MiB
maximum per prepared clip, four three-clip reviews need at most 144 MiB per child
per billing period. Two children would need 288 MiB, leaving almost no room for
other accounts under the current shared cap. Size the cohort and retention window
before choosing a project budget; client compression targets are not server quotas.

Decoupling final written feedback from media would let a future approved policy
remove video without erasing the coaching response. That requires a schema/UI and
privacy-retention review; it is not implemented or promised by this draft. Account
and profile erasure must still remove the corresponding private data.

### Owner decision notes

- Finite storage option and approved capacity/budget: ____________________
- Video retention window and customer export/deletion notice: ____________________
- Written-feedback retention after media deletion: ____________________

These are review fields, not active settings or permission to purchase anything.

## Release boundary

No production migrations 012 or 013 have been applied. No monthly entitlement,
quota increase, retention job, grouped media workflow, email sender or charge has
been activated. A future grouped capability must remain false until its entire
customer → upload → assigned coach → feedback → history journey and supported
website/native versions pass review and actual device acceptance.
