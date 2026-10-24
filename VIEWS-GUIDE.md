# Public, demo and private views

Open https://coachbilliott.github.io/Player-Development-Site/#demo to explore every fictional view. No login is required. The public homepage links to the demo and memberships; it does not advertise a free full drill library. Existing demo training/library/progress routes remain explicitly sample-data experiences.

| View           | Route        | Working experience                                                                                                                                          |
| -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public         | `#home`      | Platform overview, demo entry, membership information and member sign-in.                                                                                   |
| Demo hub       | `#demo`      | Six clearly fictional role previews and guided sample training.                                                                                             |
| Owner          | `#workspace` | Account-level management, all accessible staff content, upload entry and launch readiness.                                                                  |
| Manager        | `#workspace` | Content overview and editing across coaches; no account directory or level grants.                                                                          |
| Coach          | `#workspace` | Own-content overview, publishing and editing; no private household access.                                                                                  |
| Parent         | `#workspace` | Private family roster, add/edit profiles, per-athlete training and permission/review controls.                                                              |
| Adult Athlete  | `#workspace` | One individual profile, its next illustrative practice and history; standalone or family-linked.                                                            |
| Junior Athlete | `#workspace` | A simpler individual training view when an eligible junior connection exists; parent approval remains required. Real junior enrollment/access stays closed. |

Real workspace selection uses the authenticated server-assigned level, never a browser switch. The junior presentation also uses the loaded private athlete age/context. `#access` is Owner-only. Staff do not automatically gain private family/player access. `#account` keeps account setup, recovery, privacy and sign-out controls. Demo routes never change these real grants.

## Fictional previews

Use `#demo-owner`, `#demo-manager`, `#demo-coach`, `#demo-parent`, `#demo-athlete` or `#demo-junior`. Owner preview role changes are a local screen simulation that resets on refresh. The Coach preview uses browser-only sample uploads. Parent/Adult/Junior previews reuse the fictional family engine and its separate local storage. In Parent preview, select Casey and allow self-recording; Junior preview can then report practice and the parent can review it. Each athlete sees only their own sample history. All people are fictional; no preview grants staff permissions or creates child accounts.

## Protected content

Migration 005 has been applied once after migrations 001–004 to the dedicated project. Do not rerun it. Existing and new shared uploads default to `member_only`. Owners/Managers can review protected content across coaches; Coaches can review their own. Anonymous users and unpaid Parent/Athlete accounts cannot read protected metadata or request signed media URLs. The storage bucket remains private. Staff must explicitly choose **Public demo sample** to make a shared resource free. Only public samples enter fictional demo training/library pages, including when staff are signed in.

There is no paid entitlement yet. Protected means staff review only until packages, billing and entitlement enforcement are implemented and tested. The member training-library view explains this state and does not pretend a subscription exists. The fixed illustrative private pilot practice catalog remains separate from paid content.

Signed media URLs expire after five minutes. Existing bearer URLs remain usable until expiry; access restrictions prevent future issuance rather than implementing DRM. Refresh the library to renew expired previews. The client isolates fetched resources by authenticated identity and role, clears signed-in data on sign-out, and never stores private library data in demo storage or the service worker cache.

## Remaining launch work

Define packages, recurring billing and failed-payment/cancellation entitlements; complete reviewed real training and media rights; verify email/recovery and actual staff accounts on physical phones; finish verified guardian consent, age transition, retention and support processes. Public registration and real child enrollment remain closed. Nothing here activates payments or guarantees athletic, scholarship or recruiting outcomes.
