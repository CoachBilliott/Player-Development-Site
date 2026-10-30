# Migration 023 read-only acceptance probe

## Status and boundaries

This branch is the isolated test harness, based on its deployed source, not a production website change. It retains the six-account allowlist, fixed Supabase project `ojcfrfpeftvngyluomex`, memory-only Auth, CSP and original controls. No SQL, credentials, roles, flags or fixture records are changed by this correction.

The existing desktop helper owns installation, acceptance and rollback. Do not duplicate its browser or SQL work. Do not refresh its six authenticated tabs until the coordinating operator has a supported sign-in plan.

## Why version 2 is necessary

The first hosted rehearsal passed all six role scopes, paired anonymous denial and legacy detail boundaries, then completed exact rollback. Owner, Manager and Other Coach paging aggregates failed. Their original failed receipts must remain preserved. The original tool recorded no failing subcheck or returned set, so attribution of those hosted failures is an inference.

The source defect is independently established: SQL searches the caller's authorized athlete name, client label, position, coach label and workout title. The old probe expected nickname-only matches. In the approved fixtures, “Other” also matches `repformed-learning-other-coach@example.test`, so it can legitimately return both Jordan and Other. Coach client labels stay minimized; hidden client emails must not match.

Version 2 derives expected search matches from the visible fields of an independently scope-checked baseline. It still requires exact allowed profile sets, scoped totals, counts and pagination. It includes positive permitted-label searches and negative hidden-client-email searches. It does not turn every returned row into an expected match or relax role boundaries.

Each subcheck records a fixed, readable case name, verified role, outcome and time. A failing comparison displays only fixed fictional athlete aliases and counts, never raw emails, tokens, URLs or payloads. Downloaded receipts retain the strict field allowlist, identify `roster-search-v2`, and use timestamped filenames to avoid overwriting the failed original receipts.

## Available UI and session constraint

The deployed harness exposes four fixed roster buttons under **Boundary checks → Migration 023 · roster acceptance**. It has no manual 023 search input. Training-bank group search uses the different migration 021 API and is not an equivalent test. Existing profile controls exercise the legacy detail API only.

Loading the corrected bundle requires a normal page refresh. Auth intentionally does not persist across reloads, so a new private sign-in is required afterward. Publication alone does not refresh or discard the current tabs. No script injection, session extraction, credential transfer, browser security change or privileged emulation is a supported substitute.

The existing **Refresh verified role** button uses ordinary SDK identity/role checks without reloading the page; it does not load new probe code. Normal SDK requests may renew an in-memory session when needed. Do not inspect tokens or change Auth configuration to keep a session alive.

## Coordinated acceptance steps

1. Keep the current tabs and failed receipts intact. Confirm the corrected deployment receipt and a private re-sign-in plan before refreshing any tab.
2. Verify the exact isolated project, unchanged SQL/rollback hashes, six identities, helpers and all four flags off. The new probe must say **Search probe version 2**. Missing migration is blocked, not a permission pass.
3. Only the existing operator may reinstall the exact approved migration under the coordinated rehearsal scope. No new accounts, role/assignment changes, mass fixtures, learning activation, scheduler or sends.
4. For each normal staff session, run **Check signed-in roster scope**, **Check roster paging and filters**, and **Check direct athlete detail scope**. Parent sessions must receive explicit staff-access denial; their paging button remains disabled.
5. Expected scope: Owner/Manager see all three fixtures; Coach sees Avery; Other Coach sees Jordan and Other. A truly unassigned Coach is not represented by these fixtures and remains untested.
6. Expected “Other” search: Owner/Manager and Other Coach see Jordan plus Other; Coach sees none. Owner/Manager can search permitted client labels. Neither Coach may match a hidden client email. All matches stay inside the independently verified scope.
7. Pair **Check anonymous roster denial** with a successful staff control. Missing function, expired Auth, network failure and malformed data do not become passes.
8. Download timestamped receipts before changing roles. On failure, retain the exact fixed subcheck and the safe expected/observed note. Do not export Auth headers, full HAR data, passwords, keys, signed media or raw provider responses.
9. Rehearse exact rollback. The new roster control becomes blocked because capability is absent; the separate legacy detail control must still pass. Preserve identities, history and the harmless retained indexes. Restore no flags automatically.

## Limits

This probe covers small-fixture real-role API behavior when actually exercised. It does not certify production dashboard navigation, large hosted load, an unassigned Coach, assignment/role revocation, a seventh Athlete account, private Storage, weekly release/grading, migration 022/024, native device behavior or production permissions. Local mocked and PostgreSQL-emulation tests remain source evidence only. Production and TestFlight 15 are unchanged.
