# Homepage and website navigation review

The public homepage now explains Foundation → Fundamentals → Position Development
→ Elite Coaching using the deployed proposal definitions. Foundation stays
learning-only; position work adapts/replaces two drills; selected written reviews
remain monthly. A compact progression, proposed weekly rhythm and parent
visibility replace the workout-only introduction. No duplicate pricing table,
finished curriculum, results, enrollment or launch date is promised.

The hero compares proposals. Express interest opens the existing package page at
its email controls with keyboard focus. Only the one-time navigation hint is
consumed; other URL parameters survive. Interest remains the visitor's mail-app
message, not captured signup, enrollment, payment or mailing-list registration.

The public header says Log in when signed out, Dashboard when signed in. Both
mobile navigation and footer agree, using the existing role-aware workspace gate.
A small session-restoration guard prevents older asynchronous reads from
undoing newer sign-out/account-switch events. No server roles or policies change.
The universal status strip is removed; the fictional demo keeps its sample-data
indicator. Relevant availability/guardian guidance stays in the appropriate flows.

Footer navigation is grouped under Explore and Help & access, with five compact
44px social targets, accessible platform names, Contact, account/privacy help and
credits. App & installation describes the existing web-app installation page,
without implying a public App Store download. Contact/help social displays retain
their existing labelled-link variant. Approved black/gold assets, licensed images,
looping footage and OS reduced-motion behavior are preserved.

Local validation: lint, TypeScript, build and **307 unit/database tests passed**.
All **14 new header/footer cases passed** on desktop and phone, covering five
roles, restore/signout, mobile menus, wrapping, focus, social targets and axe.
Earlier affected homepage/package/contact checks passed; a dev-reload motion
failure passed all eight fresh-process motion cases. Initial hosted CI reported
six obsolete headline assertions; their text expectations were corrected while
preserving routing/access assertions. Final aggregate CI must be checked at the
latest PR head before release. Chromium phone emulation is not physical iOS QA.

Isolated homepage preview uses disabled backend/account configuration and an
explicit preview notice. Its deployment/verification receipt is separate from a
production release. No production merge/deployment is implied by this document.
No backend migration, credential, billing, notification or native release is in
scope. Staff notification WIP is preserved at bb3e838; review readiness at 37d08b3.
