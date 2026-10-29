# Public audit corrections — October29

Scope: three concrete public navigation/motion findings. No backend, account, interest-data/consent, package, legal/privacy commitment or native release changes.

- Before: decorative hero film auto-looped without a pause action. After: a keyboard-operable Pause background video / Resume background video control, with pressed state. Explicit pause survives visibility changes while that view remains mounted. Device reduced motion still renders only the existing poster. Licensed media and credits remain unchanged.
- Before: keyboard users reached the logo first. After: Skip to main content is the first focus stop and focuses the current content container without changing route/history or losing application state.
- Before: interest privacy had only bottom return links and an unlinked brand label. After: linked Repformed home plus Back to packages navigation at the top. The privacy notice wording and existing bottom links are preserved.

Validation covers keyboard activation, actual video paused/playing state, reduced motion, failed-format fallback, first-tab skip/focus and route preservation, privacy return, 320/375/390/768 layouts and no hero action overlap. This is a bounded remediation record, not a claim of complete WCAG conformance, every-role hosted acceptance or physical iPhone acceptance. Final-head aggregate CI and production provenance must be recorded separately before calling it live.
