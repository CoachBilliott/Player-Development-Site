# Public accessibility release receipt

Published sourcec8713b59434172b3c89f8bd637499ae0545fdb07, PR18, Cloudflare production deploymentafe8e4ab-f0b0-4382-a3b7-28e5894cf787 at16:51:43.492551UTC October29. Canonical repformed.com and immutable https://afe8e4ab.repformed.pages.dev. Provider source/environment/success verified; worker frontend403/1010 was not retried. Independent live-browser confirmation is tracked separately.

Three substantive changes: Pause background video / Resume background video, keyboard-first Skip to main content without changing route, and linked brand/Back to packages at the top of interest privacy. No privacy commitment, package, auth/intake, security, database, email or native-release change.

PR CI40911267553 and main CI40913744098 both succeeded:378 unit/database,408 website,10 app/offline,6 isolated preview,11 Python plus lint/types/Deno/build. Fresh normal-auth production artifact passed30 affected desktop/phone checks; config hash is unchanged and all72 artifact files were hash-verified.58 focused source/browser checks overlap aggregate suites. Redundant local full-browser runs were canceled after final exact-head CI passed; never counted as passes.

Original desktop/phone screenshots show the normal-motion control and were inspected locally. Viewports320/375/390/768 passed no overflow/action overlap and minimum44px control-height checks. These are local browser evidence, not live physical-iPhone or private-role acceptance. Native installed build13 remains unchanged; separate unsigned validation is waiting for hosted macOS capacity. Weekly learning PR13 remains draft, its activation and hosted acceptance separate.
