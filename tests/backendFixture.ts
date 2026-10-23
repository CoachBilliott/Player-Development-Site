import type { BrowserContext } from "@playwright/test";

// Default browser tests are isolated from the owner's live project. Tests
// exercising Auth install their own fictional backend route after this one.
export async function disableBackend(context: BrowserContext) {
  await context.route("**/content-config.json", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        url: "",
        publishableKey: "",
        membersEnabled: false,
      },
    }),
  );
}
