# Build 14 audit follow-ups

This change addresses login help/tag spacing, oversized roster DOM, overdue review action priority, and obsolete review-access navigation. The duplicate support row is removed; header and bottom navigation Help remain. Public homepage, intake, auth, roles, storage and learning switches are unchanged.

The roster renders 25 filtered athletes per page, keeps an athlete's page on return, resets the page on filter/search changes and clamps it after smaller refresh results. Keyboard paging returns focus to the result count. Search and summary counts still cover the full currently authorized response. This bounds screen rendering; the existing migration015 RPC still returns the complete authorized roster. Hosted server pagination/load remains a separate acceptance and deployment dependency, including PR13's draft scoped paging. No new API, permission grant or migration is included here.

Pending/past-due review work leads the detail panel; Owner workout assignment remains available as a secondary action. Managers/Coaches gain no assignment or administrative authority. Only Owners get the direct permissions link from an empty review queue.

Regression coverage: removal of the duplicate login helper with retained keyboard header help; 1,000-record page size and search; page/detail/back focus; filter and no-results reset; final partial page and shrinking refresh; Owner review action order; Owner-only access link, Manager/Coach absence; assigned Coach scope. Existing role, guardian and last-owner tests remain required.

Release gates: final exact-head full CI; fresh normal-auth web build; main CI and native simulator/archive for exact merged source; signed TestFlight upload with a unique build number and Apple processing receipt. Re-audit the exact resulting web/IPA assets. Build 14 is not retroactively fixed, and web publication does not update an installed native app. Physical-device performance and deployed role/Storage acceptance remain separate.
