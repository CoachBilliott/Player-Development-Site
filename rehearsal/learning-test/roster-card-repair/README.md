# P2-01 repair: source prepared, not released

The strict build-16 audit found Refresh escaping the Coach roster card at 320px. Exact exported-IPA geometry reproduced the defect for assigned and unassigned Coach; Owner/Manager and wider cases fit. The failed receipts remain in ../build16-audit/fixture-results/geometry and the accessible audit was consolidated before repair work began.

Draft PR #25: https://github.com/repformed/Player-Development-Site/pull/25

Exact head: `ea0fb3e1014aec2da6fe70db7fabf529ce2078c1`. It adds one CSS rule, `flex-wrap: wrap`, to the roster heading and a card-boundary/interaction regression. It preserves role text and the minimum 44px control. No permissions, data, packages, auth, intake, credentials, flags or backend changes.

Eight local desktop/phone cases passed, covering Owner, Manager, assigned and unassigned Coach at 320/375/390/768/1440px; actual Refresh click remains usable. Lint and a clean type build passed. Initial test-selector failure was corrected to the existing exact accessible name “Refresh client service”; card geometry assertions remained unchanged.

Final aggregate CI 41005538393 is running. Do not mark the released defect closed from this source screenshot. Website and TestFlight 16 remain source 51841292. Conditional ordinary repair release can proceed only after required terminal checks; a new internal build needs its existing signed workflow and exact-source gates. Read-only Apple preflight 41005953849 confirmed build 17 unused at 05:00:18 UTC. No new upload has started.

The corrected hosted roster probe remains a different tool/project path; six retained sessions were not refreshed or altered. Learning/paging migrations and activation remain separately gated. No full-role/device grade is claimed.
