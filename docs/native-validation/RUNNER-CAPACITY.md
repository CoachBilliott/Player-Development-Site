# Unsigned iPhone validation runner correction

Two unsigned runs never acquired a macOS runner:40908989034 (source6e37d105) and40913930615 (sourcec8713b5). Both ended before any steps with “The job was not acquired by Runner of type hosted even after multiple attempts”; GitHub annotations cite arm64 capacity. These are not code/test failures or passes.

The current official runner-image table maps macos-15 to arm64 and macos-15-intel to x64. Use the standard Intel label for the existing unsigned simulator/archive workflow and, under the owner’s subsequent native-release request, the existing signed distribution workflow. Its documented image includes the same /Applications/Xcode_26.3.app, iOS26.2 SDK/runtime and iPhone17 simulators. The repository is public; GitHub documents standard runners, including this label, as free and unlimited for public repositories. Do not use the paid large/xlarge labels or provision another service.

References inspected October29,2026:
- https://github.com/actions/runner-images/blob/main/README.md
- https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners

Only runner selection changes. Existing permissions, Xcode pin, simulator tests, unsigned device archive, bundle/configuration, signing commands and artifact retention remain unchanged. The signed workflow still requires successful exact-main source and simulator checks before using existing signing secrets; upload remains an explicit manual input. The owner separately authorized a TestFlight update, not a public App Store release or new testers. No new Apple credential/permission, signing identity, production configuration or website deployment change is introduced by this correction. A successful Intel simulator result does not establish physical-device acceptance; the unsigned generic iOS archive still cross-compiles the device target.

One materially different validation attempt can run on this branch after static verification. Capacity is not guaranteed; do not loop or silently choose paid resources if this standard pool is also unavailable. Record exact source, workflow/run, runner image/architecture and test/archive outcomes separately from installed TestFlight build13.
