# Assigned workouts and private video review

The native app is for real account access. The single public sample demo remains on the website and is blocked on app routes. Customer accounts start empty; built-in demo drills are not inserted into real plans.

## Upload a drill and make it available

1. Sign in to the Owner/Coach workspace and open **Content** / **Upload & content**.
2. Choose **Shared website**, upload your original or licensed demonstration, and add a title, short lesson, equipment, steps, coaching cue and intended age/position/experience/goal.
3. Submit the protected draft for review; an Owner/Manager approves it before publication. Public demo samples are a separate explicit visibility choice.
4. An Owner opens **Account access → Workouts & video review access**, chooses the verified customer account, checks the uploaded workouts, reviews and saves the change.
5. The athlete refreshes **Today** or **Workouts**. Only assigned drills matching that athlete's age, position and experience appear. The goal ranks the available plan. Before starting, the session lists each drill and equipment. Begin once, then each drill shows its demonstration, purpose, numbered steps, equipment and cue together, with its position in the session and a preview of the next drill. **Complete drill · Next** advances; **Previous drill** revisits an earlier activity; **Finish workout** submits a practice report. Moving backward or playing a video does not submit a report. Use **Save & leave workout** to preserve the private unfinished place across refresh/reopen; saving a place never creates a completion report.

Do not treat a video view, a completion button or a parent review as proof of athletic improvement. Training remains noncontact and pending qualified coaching review. No real junior enrollment was opened.

## Enable the optional video feature

In the same Owner access panel, enable **the optional video review feature**, choose the assigned review coach, and review/save. This permission is separate from workout assignments and account roles. It is a manual pilot entitlement: it does not create a paid subscription, collect payment or set a package price. A future trusted billing integration can grant/revoke it according to a package; customers cannot grant themselves access.

## Record and submit

1. Open the athlete's training and tap **Send a drill video**.
2. Choose the assigned drill, then **Record video** to use the phone camera or **Choose video** to select a saved clip. iOS may ask for camera/microphone/photo access when you choose those actions.
3. Preview the clip. Nothing uploads merely because a file was chosen. Canceling the system picker preserves the current selection; canceling the composer removes the unsent selection. Replacing it with an invalid file clears the earlier selection.
4. Tap **Send for coach review**. Keep the app open during the upload. If the response is lost, retry the same selected clip; a stable submission ID prevents duplicate records and objects. If you cancel after a failed attempt, the draft/object are removed before closing the composer.
5. Check **Sent for coach review** and, later, **Coach feedback ready**. A family-linked athlete's clip first requires **Approve & send to coach** from the parent. A parent submitting directly has already made that decision.

The native app also offers **Choose & prepare iPhone video**: select a Photos recording, choose up to 60 seconds and prepare a smaller H.264 MP4 before preview/send. The original remains in Photos. Native preparation targets at most 12 MB; selected recordings can need a shorter range. Transfer progress reports real uploaded bytes, followed by submission confirmation. Canceling preparation keeps any earlier selected valid clip. Keep the app open.

The pilot accepts MP4, MOV or WebM, up to **60 seconds / 40 MB**, with **5 active clips per household/account** and a **300 MB shared review-video reservation budget**. The database and private Storage bucket enforce byte limits/access; the client checks playable duration and file signatures. Conversion is performed on the iPhone, not on a server. Browser uploads retain their original codec. Server-side transcoding, duration verification and malware/content scanning are not implemented. No automated AI analysis is claimed. Camera availability, MOV/HEVC compatibility, microphone handling and background/upload behavior still require physical-iPhone testing.

## Shared service desk and 48-hour delivery

Customers without access can request one drill review without a charge. Requests and video submissions are saved automatically for Owners/Managers under **Service desk & reviews**. They track assignments, follow-up, due-soon/overdue targets and actual feedback delivery. The 48 consecutive-hour clock starts after a complete approved submission and never resets on reassignment. See [SERVICE-FULFILLMENT.md](SERVICE-FULFILLMENT.md) for the customer/staff steps and remaining payment/alerting requirements. Real junior media stays closed.

## Coach review

Open **Reviews** in the app or **Video reviews** on the website. The assigned coach can open a private clip, enter a concise coaching note and send feedback. Only authorized family users and the currently assigned, approved coach can read that submission; being an Owner, Manager or another Coach alone does not grant clip/profile access. Coaches receive the drill title/date/submission reference, not general access to private player profiles. Feedback is attached to the submitted clip; this is not direct messaging.

Migration 011 snapshots the initial account-level coach onto each submitted review. Owners/Managers reassign existing reviews through the shared service desk; changing the account default affects future uploads. Disabling account review access or reassigning that review removes the previous coach’s new reads immediately. Already-issued signed media URLs last up to 60 seconds; instruction-media links last up to five minutes. Private videos and account data are never placed in the public demo cache or persisted into demo localStorage.

## Deletion and launch limits

Clips remain stored until the authorized family/uploader deletes them; there is no automatic retention schedule. **Delete video → Delete video permanently** removes the stored object and its review. Unfinished uploads also appear in history for cleanup. Stored clips must be removed before deleting the athlete/profile data, preventing a cascade from stranding Storage objects. Password-confirmed customer deletion removes Auth/profile/media and cascades service metadata; staff/guardian cases follow assisted review. See [ACCOUNT-LIFECYCLE.md](ACCOUNT-LIFECYCLE.md).

Real under-18 video submissions remain closed, including parent submissions, until a qualified guardian-consent, child-media privacy and retention process is implemented. Changing a minor profile's age label does not bypass the restriction. Payments, monthly billing, package prices and public signup remain inactive. External beta review needs a real approved adult review account and accurate privacy/contact disclosures.

Migrations `006-assigned-training-and-video-review.sql` and `007-training-assignment-cleanup.sql` were applied once to the dedicated Player Development project. Do not rerun them. Existing enrollment gates remain false; no access grants, customer clips, payment records or emails were created by installation. Automated fixtures are fictional, and the black-frame test clip is an original test asset, not a coaching demonstration.

When protected content is withdrawn, made public or deleted, its old assignments are removed automatically. Existing submitted video feedback remains available according to its private review permissions.
