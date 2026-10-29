# Repformed quality remediation

Baseline: production `5491236a05b4e655243bd7ea0f24f513eea47b3e`; learning draft PR #13 `71be2f05e3d734697e38b9c89e4bfdf43f59ee34`.

This record tracks defects and acceptance, not a replacement numeric grade. The independent public audit scored C / 74. A fresh deployed audit is required before changing that score. Private/live-role, physical-device and hosted-learning outcomes cannot be inferred from synthetic browser or policy tests. An unresolved P0/P1 in the release scope blocks release; unverified remains unverified.

## Implemented slice, not yet published

| Finding                                                    | Source change                                                                                                                                                 | Validation evidence to complete                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P1 historical staff walkthrough used as customer guide     | New `#customer-help` guide in the shared app shell. Contact/footer link it. Original walkthrough/PDF retained with a build-10 archive banner.                 | Customer journey navigation, archive/PDF availability, screenshots and fresh live review.                            |
| P1 missing price unit and quota scope                      | Owner-approved USD per athlete; one guardian can manage multiple athletes; two monthly reviews per subscribed Elite athlete, not shared. Prices unchanged.    | Package proposal and selection tests; no checkout/enrollment activation.                                             |
| P2 public conversion hierarchy                             | Express interest primary; existing-member login secondary and available in phone navigation. Signed-in Dashboard preserved.                                   | Desktop/phone navigation, session restore and role fixture checks.                                                   |
| P2 hard-to-compare packages                                | Four consistent compact rows, expandable inclusions, per-plan interest action.                                                                                | All four selections, layout/contrast and expanded content.                                                           |
| P2 plan selection requires re-entry                        | Controlled package selection shared with form and email fallback; name, email and consent stay intact. Sending/received requests lock selection.              | No automatic POST; unchanged consent; pending/received race and existing retry/idempotency tests.                    |
| P2 app-help links touch                                    | Shared wrapping action row with real gaps and touch-size controls.                                                                                            | Bounding-box and accessibility checks.                                                                               |
| P2 customer help starts with Owner instructions            | Account setup/deletion/retention first; staff invitation/closure references retained below with jump links. Existing privacy/retention commitments preserved. | Ordered sections, retention assertions and static-page contrast.                                                     |
| P2 inconsistent help appearance                            | Shared brand09 help colors, self-hosted licensed typography, customer guide within normal header/footer. Historical document remains explicitly historical.   | Desktop/phone screenshots; 320/375/390/768/1440 widths; accessibility checks.                                        |
| P2 browser app entry lacks website exit                    | Signed-out browser app header links to canonical website without app-mode query; native constraints retained.                                                 | Start/account/help navigation with mocked external destination; app tab/session state retained.                      |
| P2 signed-in installation still says Log in                | Installation action becomes Open dashboard for signed-in sessions.                                                                                            | Owner/Manager/Coach/Parent/Athlete fixtures; compiled PWA checks.                                                    |
| P2 preview suggests a broader product than it demonstrates | Preview heading/description explicitly covers fictional practice/family controls and excludes proposed lessons/quizzes.                                       | Existing demo flows and motion/accessibility regression. A package-aligned media tour remains separate content work. |
| P2 wrong assignment authority in review instructions       | Neutral team-handoff wording; no coach permission expansion. Staff denial copy uses current Athletes navigation. Existing inline athlete assignment reused.   | Existing staff/role/negative-scope browser and policy suites.                                                        |

## Validation record

Initial focused run: 66 passed, 2 failed (the same account-help intro contrast issue on desktop/phone). The inherited light-guide foreground was 2.41:1 against the new dark background. Corrected the foreground; the final affected/full checks must pass without relaxing accessibility assertions.

After correcting contrast, 76 focused desktop/phone cases passed, including account/role/workflow, intake loading, public help, proposal wording and accessibility. A later 58-case selection/demo run passed 57 with one obsolete phone-header login expectation; it is updated to exercise the member-login menu and its full journey. The corrected desktop and phone login/demo journeys both passed their targeted rerun.

Local lint, 375 unit/database tests and 11 Python tests passed before the final copy-only refinements. Ten compiled-web-app/offline cases and six disconnected fictional-preview cases passed. A final exact-head CI run remains required. Final exact-head aggregate CI is authoritative; overlapping counts must not be added. Browser requests, roles and email acceptance use fictional fixtures. No real form submission, email, customer change or live role certification is performed by those tests.

Screenshots are generated under ignored `artifacts/customer-journey/`. They represent local source, not live production or physical iPhone acceptance.

## Boundaries and remaining work

- Public registration, payments and real junior enrollment/media stay closed. Existing production configuration, auth/RLS, interest persistence/sending and consent semantics are preserved.
- Proposed Elite turnaround remains a **target of three business days, not guaranteed**. Historical service-desk timing is not changed.
- Rollover, billing-period boundaries, refunds, footage retention and storage budget remain undecided. Five clip spaces are storage, not monthly review credits; no unlimited storage promise or new deletion job.
- Grouped review code exists (up to 180 seconds over 1–3 clips of at most 60 seconds); source does not prove activation. No migration013/014 installation or credit activation is included.
- Migration015 Manager all-client service metadata and service-coach assignment are intentional. Owner-only workout assignment is not broadened. Coaches retain assigned scope; review-coach responsibility is separate.
- PR #13 weekly learning remains draft/unmerged/unactivated. Hosted quiz/enrollment/grading/release/history acceptance and production recovery/security approvals remain gates. Package/client learning-rule integration remains separate.
- Coordinator verified the isolated test project's four learning/scheduler/notices/youth flags OFF at 12:21 UTC. Interrupted quiz upload persisted zero quizzes/versions/attempts/grades/enrollments. Harness navigation remains blocked by ERR_QUIC_PROTOCOL_ERROR; no bypass/retry through other credentials is authorized.
- Social channels need approved content; no posting/account changes are included. Native TestFlight build 13 is unchanged. Neither an A+ public launch nor B+/A− private readiness is certified by this source work alone.

## Release gates

Exact final-head lint/types/Deno/unit/Python/build/website/PWA/preview CI; representative layout review; fresh normal-auth production artifact; unchanged configuration; retained verified rollback artifact; approved existing Cloudflare workflow; canonical deployment/source verification. Then fresh live public navigation/copy review. Never promote a disconnected review build as production or reuse earlier green results after changes.
