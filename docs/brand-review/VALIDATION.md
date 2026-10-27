# Repformed validation — 27 October 2026

Verified source revision: `18b949f4a2b4da3f81d5b3f556f15be519fb08d0`.
Base: main `0185525`. This record is added in a documentation-only follow-up.

## Results

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript / production build | Passed; Vite reports the existing large-chunk warning |
| Vitest, one worker | 234 passed across 20 files |
| Python script checks | 10 passed |
| Deno 2.5.6 account-lifecycle type check | Passed |
| PWA/offline browser suite, final source | 8 passed, no retries |
| Full desktop/phone browser suite | 218 passed, 8 failed, 2 flaky; 228 cases executed |
| Fresh-process rerun of all eight failed cases | 8 passed, no retries; no unresolved failures |
| Additional saved-draft regression check | Desktop and phone both passed |
| Visual capture checks | 1440px desktop, 390px phone and 320px app; no horizontal overflow |

The full browser run used `--workers=2 --timeout=90000 --retries=1` because
the saved cloud environment exceeded the normal time budget during the initial
run. The final targeted run used the same flags with `--last-failed` and
`--reporter=line`. It exited successfully; Playwright recorded `status: passed`
and an empty `failedTests` list. This was **not** a clean single-pass full run.

## Failures investigated and resolved

- The 320px signed-in website header overflowed because of the wider wordmark.
  Compact mark/type dimensions were corrected. The footer now wraps at tablet
  widths. The existing saved-draft test checks 320, 390 and 768px and passes.
- The desktop and phone public-navigation tests retained the old short logo
  locator. The test now matches the complete visible name, `REPFORMED ATHLETE
  DEVELOPMENT`. The main runner had collected the old locator before that edit;
  both cases passed in the fresh process.
- A temporary accessible-name variant failed the phone label/name consistency
  audit during live verification. It was removed before the verified source
  revision. The final logo uses its visible text as its accessible name; the
  full phone accessibility sweep passed on rerun.
- Four desktop workout cases failed while the local development server was
  unavailable (`ERR_CONNECTION_REFUSED`). The server was restored and all four
  passed in the final rerun.

The two flaky cases in the full run were the desktop invitation-email failure
test and the desktop lost-workout-save-response test. Both passed their first
retry. The fresh-process failed-case rerun required no retries.

## Evidence and limits

The six adjacent PNGs are public, backend-disabled browser captures. The
320px app image includes the compact-mark correction. `scripts/capture-brand.mjs`
reproduces the captures and checks for horizontal overflow.

Detailed logs in the saved task environment:

- `/tmp/repformed-browser-final.log`: original full run and its terminal tally.
- `/tmp/repformed-rerun.log`: eight final passing reruns.
- `/tmp/repformed-app-final.log`: final production build and eight PWA checks.
- `/tmp/repformed-unit.log`, `/tmp/repformed-python.log`, `/tmp/repformed-deno.log`.

GitHub CI, native iOS builds, simulator/physical-iPhone acceptance and deployment
were not run. Browser phone emulation does not establish physical-device
acceptance. Backend configuration, official social URLs, native bundle settings
and production origins are unchanged. No merge or publication to production
occurred. Draft-PR creation was rejected by automatic approval review and was
not retried; it still requires explicit authorization.
