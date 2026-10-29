# Sunday copy release and read-only public UX findings

The homepage now says **“Proposed drill packages would release content on Sundays.”** This corrects the inactive-package tense mismatch without changing pricing, delivery rules, design, intake, permissions or activation.

Published PR14: production source `3d35ccc626ee054151a578c0bd0888f12c21f698`, Cloudflare deployment `6ba70ade-a02b-4611-974f-e5fbe70c5a4a`, [repformed.com](https://repformed.com/), entry `assets/index-yKoZJl6r.js`. Fresh normal-auth configuration equals the previous production artifact. [PR CI 40816007065](https://github.com/repformed/Player-Development-Site/actions/runs/40816007065) and [main CI 40817369994](https://github.com/repformed/Player-Development-Site/actions/runs/40817369994) passed. Main: 375 unit/database, 358 website, 8 compiled app/offline, 6 isolated preview and 11 Python checks plus lint/types/Deno/build. 16 targeted checks also passed against the production artifact; they overlap CI coverage and are not added to its totals.

The still-draft learning branch is reconciled with that main at `05b2ecb06cfa325fad08972ab6ae79692c193a28`, preserving future-facing weekly wording and exact midnight timing. [CI 40817611141](https://github.com/repformed/Player-Development-Site/actions/runs/40817611141) passed: 428 unit/database, 366 website, 8 app/offline, 20 isolated preview and 11 Python checks plus lint/types/Deno/build. Backend/migration source is unchanged. PR13 is unmerged/off; no database, role/account, credential, scheduler, notification or native change occurred.

## Investigation results, not bundled fixes

- **Config-loading flash confirmed:** Membership shows the email fallback before its enabled intake configuration arrives, then replaces it with the direct form. This is a presentation-state issue; no form was submitted and delivery was not retested.
- **Update prompt:** expected when a worker is genuinely waiting after a web/PWA deployment. A separate two-tab state/action mismatch was reproduced locally after one tab activated the update. Another tab can still need a reload of its older JavaScript; the correction should preserve an explicit save/reload path, not blindly clear the prompt or auto-reload. The actual live browser's worker state was not inspected. This is unrelated to native TestFlight packaging.

[Read the evidence and recommendations](FINDINGS.md) · [controlled local states](LOCAL-INVESTIGATION.json) · [exact release/CI receipt](COPY-RELEASE.json).

The coordinating parent's earlier independent live desktop spectator audit passed core public navigation/disclosures at 04:00–04:02UTC **before** this copy release. It submitted no forms. Mobile, privileged roles, destination socials, actual post-copy browser rendering and current form delivery remain unverified by this worker. Its known Cloudflare frontend restriction was not retried or bypassed. The separate pending browser upload approval was left untouched; zero new form/email submissions. Installed iPhone build 13 is unchanged.

[Conditional learning approvals/recovery/live-audit gates](../conditional-release/README.md) remain in force. The read-only SW/hydration findings do not activate those features or authorize new live actors.
