# Official social accounts

The Owner requested shared official links. **Five profile URLs have been verified through the Owner’s signed-in account controls.** YouTube’s public channel URL is also verified for website linking; upload access remains separate. No handles have been inferred from the Gmail address, provisional branding or a search result. No social account has been created, claimed, posted to or connected for automated posting.

`public/social-links.json` is the single published source. It currently publishes the approved Instagram, TikTok, Facebook, X and YouTube accounts. Add further Owner-verified profiles as entries with `platform` and full HTTPS `url`. Supported platform labels are Instagram, TikTok, Facebook, X, YouTube, Threads, LinkedIn and Snapchat. Other platforms can be added explicitly when requested. The renderers validate exact platform hosts, reject credentials/alternate ports/placeholder homepages and show one entry per platform. Outbound links identify the platform and open externally without embedded feeds or tracking SDKs.

The shared links appear in:

- Every website footer, including the public site and signed-in website screens.
- The Contact page alongside the team email.
- App Help in the mobile app source.
- The online partner walkthrough, account help and phone test checklist.

The online guides load the same configuration. The walkthrough generator preserves its social-link mount when rebuilt. Downloaded PDFs and previously installed iPhone binaries are snapshots, so adding links to the website does not update them automatically. After actual URLs arrive, regenerate any PDF that needs social links and release a tested native update before claiming those copies include the accounts. No email-template or App Store/social-profile field changes are implied; those require their own configuration and access.

`tests/help-socials.spec.ts` intercepts fictional URLs only inside tests. Those fixtures are never written into the published configuration. It checks the shared links across the website, mobile help and all three online guides, including safe external opening and narrow-screen overflow.
