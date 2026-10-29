# Public UI corrections: interest loading and multi-tab updates

These screenshots show local desktop and phone Chromium using the correction source, mocked account/intake services and real local service workers. They are not screenshots of live production, real clients or native iPhone acceptance.

- `screenshots/intake-loading-*.png`: configuration is deliberately delayed. Only an accessible loading message appears; there is no misleading email-app action.
- `screenshots/intake-ready-*.png`: configuration enables the direct form; no submission was sent.
- `screenshots/other-tab-*.png`: another local tab applied an update. This tab remains open with its unsaved in-memory note and offers a confirmed reload.

[Phone loading](screenshots/intake-loading-phone.png) · [Phone form ready](screenshots/intake-ready-phone.png) · [Phone second-tab reload](screenshots/other-tab-phone.png) · [Desktop second-tab reload](screenshots/other-tab-desktop.png).

The earlier investigation documented reproduced defects, not final behavior. Correction PR: https://github.com/repformed/Player-Development-Site/pull/15 . Published production source `5491236a05b4e655243bd7ea0f24f513eea47b3e`, Cloudflare deployment `ca16c62f-4497-4364-b656-462005cc6c45`, [repformed.com](https://repformed.com/). [Exact release receipt and CI counts](RELEASE-UI-CORRECTIONS.json). PR and main CI passed; production provenance is provider-verified. The coding worker did not retry its known frontend restriction. The separate earlier live spectator audit remains valid for its own scope and predates these fixes.

Weekly learning PR #13 is still a separate draft, disabled in production. Hosted quiz/enrollment/Storage acceptance, production recovery evidence and specific activation permissions remain outstanding. The UI correction does not enable them.
