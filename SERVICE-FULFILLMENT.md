# One drill review: customer experience and service delivery

This is the private adult pilot, not a paid checkout. No prices, purchases, review-credit balances, subscriptions or payment status are invented. Public demo data is separate. Real junior enrollment and video uploads remain closed pending consent, safeguarding and retention work.

## Customer

1. Sign in to the real account and open the athlete’s training.
2. If review access is not enabled, choose **Request one drill review**. The shared request reference and “Request received” confirm it reached the team. Duplicate taps create one pending request. Cancel an unsubmitted request with **Cancel review request**; no payment is taken.
3. After an Owner enables pilot access and assigns suitable training, choose **Send a drill video**. Select the drill, record or choose a clip, preview it, and send. Limits: 60 seconds, 40 MB and five active stored clips per account; these are storage limits, not paid credits.
4. If a family-linked submission needs account-holder approval, the coach cannot open it before approval. Real child media remains blocked.
5. The review history shows the feedback target and status. Feedback appears privately in that same review. Upload completion is not proof of athletic improvement.

**48 hours means consecutive elapsed hours, including weekends.** The database starts that clock once the upload is complete and required parent approval is complete. It does not start when someone merely requests access, selects a video, begins an unfinished upload or watches a drill. Reassignment and follow-up flags do not pause or reset the clock. Existing pre-migration submissions, if any, use their creation date conservatively because their original queue timestamp was not stored.

## Owner and Manager

Open **Reviews** → **Service desk & reviews** from the app’s tools (website route `#video-reviews`). Requests and actual uploads arrive automatically. No spreadsheet or duplicate customer entry is required.

- Review open work, due within 12 hours and overdue totals. Filter by open, overdue, delivered or all; search by drill or request/account reference. Dates display in the viewer’s device timezone.
- **Manage request** assigns an approved coach and selects a follow-up flag: access needed, customer follow-up, technical help or none. Saving checks the current version to avoid silently overwriting a colleague’s update. Closing the dialog without saving changes nothing.
- For a request awaiting access, an **Owner** opens **Account access** from the request. The matching account is preselected on that device; confirm its email, assign approved matching training, enable optional pilot video review and choose the initial coach. Managers cannot activate financial/package permissions.
- The account-level coach is the initial default for new uploads. Use the service desk to reassign an existing review. This grants only that approved clip’s access; it does not open the private player profile or other family videos. Disabling account review access still revokes coach clip access.
- Open the assigned clip in the coach queue. Opening it records “Coach reviewing.” Provide one positive observation, a clear adjustment and the next practice step, then **Send coaching feedback**. Only successfully saved feedback creates “Feedback ready” and its delivery timestamp. There is no manual “mark delivered” shortcut.
- Deleting an unfinished clip closes its service as cancelled. Delivered metadata keeps its delivery result until profile/account erasure; the clip remains private and removable by its authorized account holder. Account erasure cascades service records and their event log.

The desk reads operational metadata only, not family names, ages, customer emails, video URLs, feedback text or public profiles. Staff contact identifiers are listed to choose an approved coach. An Owner can identify the customer through the existing private Account access directory. Managers escalate contact/access questions to an Owner rather than receiving the entire customer directory.

## Daily operating checklist

- Check the service desk at the start and end of the day. It refreshes on focus and once per minute while open; it is not a background alerting service.
- Assign every ready review and agree on backup coverage before accepting 48-hour work.
- Resolve upload/access blockers and required approvals without telling a customer the clock has started early.
- Prioritize due-soon and overdue work. Keep overdue work visible until feedback is actually delivered; record and resolve a service failure rather than resetting its date.
- Confirm the customer can read the delivered feedback. Delivery records saving to the private account, not proof that it was read or that skill improved.

No automatic email or push notification, staff reminder, or customer-read receipt is implemented. Audit events retain request/upload/approval/start/assignment actions in the private database; they are not a financial ledger. No automatic media retention schedule is active; the existing private pilot removal and erasure paths remain in force.

## Payment integration still required before selling reviews

Decide monthly packages, included reviews versus one-off reviews, add-on eligibility, final price, tax, refunds, failed-upload handling and cancellation terms. Configure the payment provider and Apple-compliant purchase approach separately. A verified, idempotent payment webhook must activate the purchased entitlement exactly once and link its payment reference to this service. The current manual pilot access switch is not a production credit system and must not be used as proof of payment. Test failures, duplicate webhooks, refunds, retries and access expiry before live checkout.

## Installation

Apply `backend/011-review-service-tracking.sql` **once after 001–010** to the dedicated Player Development Supabase project. It adds private service metadata and audit events, binds real video transitions to fulfillment, and preserves existing role checks, account freezes and adult-only media guards. Browser roles cannot directly read or write the service tables. Enable `serviceTrackingEnabled: true` only after the migration is installed. Older clients retain compatible video RPCs; current customer service tracking is enabled by the server’s `athlete_video_state` response.
