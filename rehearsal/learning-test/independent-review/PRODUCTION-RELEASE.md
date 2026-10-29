# Staff cleanup is published

Owner-approved PR12 is merged and deployed to [repformed.com](https://repformed.com/). The homepage, live interest form/email configuration and existing roles/permissions are preserved. Weekly learning PR13 is still draft/unmerged/off; no database migration, credential/security setting, Cron, notification change, paid/youth enrollment or native release occurred. TestFlight remains build13.

- Production source: `a58bd829ea128e39426a8e630bc35b37999581b3`, exactly the tested tree from `53f7b02905f0c10a37014efe0475aaa3fa95bf88`.
- Cloudflare deployment: `cccba94e-f378-47e8-9a67-392969a4b60a`, successful production deployment for main, [immutable URL](https://cccba94e.repformed.pages.dev). Management API confirms it serves `repformed.com` and `repformed.pages.dev`.
- Entry script: `assets/index-9Msd1-0O.js`. Fresh normal-auth production artifact,67 hashed files, configuration identical to prior production. The fictional/disconnected preview was not promoted.
- [Post-merge CI40810479138](https://github.com/repformed/Player-Development-Site/actions/runs/40810479138): **SUCCESS** —375 unit/database,358 website,8 app/offline,6 isolated-preview and11 Python checks; lint, types, Deno and build passed. Exact source/status/counts are in [PRODUCTION-RELEASE.json](PRODUCTION-RELEASE.json).
-38 additional checks against the fresh compiled artifact passed:14 assignment/role/intake and24 auth/navigation/home/social checks, with synthetic fixtures and no real account writes or emails. These overlap the full CI coverage; they are not added to its totals.

After logging in, staff use Athletes, Training and Staff & settings. Workout assignment stays inside the selected athlete; cancellation/replacement/sibling boundaries and the phone footer hit target are tested. Owner/Manager service-coach management and assigned-only Coach visibility are unchanged. Workouts still use the existing manual model; this publication does not include weekly plans, groups, quizzes or automatic release.

Provider deployment/source, artifact hashes and local browser behavior were verified. **Independent public-edge rendering and live signed-in user/device acceptance were not performed by this worker**, because of its known Cloudflare1010 client restriction; it was not retried or bypassed. Browser tests are not physical iPhone acceptance. Installed build13 is unchanged.

Before publication, all67 hashes of the prior artifact and successful deployment `4e084cca-042b-41c5-806a-1d730239cc68` at `f1e9812dce0fe465d99d5115fddcce16c9796dc2` were verified and retained. No rollback was needed or performed. This UI-only release has no database rollback operation.

The [independent review](README.md), [staged learning/rollback checklist](DEPLOYMENT-CHECKLIST.md) and historical prepublication checks remain available. Learning still requires remaining real Auth/Storage/quiz/grading/history acceptance after owner laptop recovery, usable production recovery evidence and exact permission/retention/feature/scheduler approval. Package/client overrides are not yet connected to the new global learning reminder defaults.
