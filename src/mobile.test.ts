import { afterEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { AppLauncher } from "@capacitor/app-launcher";
import { openWebsite, websiteUrl, websiteNavigationUrl } from "./mobile";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/app-launcher", () => ({
  AppLauncher: { openUrl: vi.fn() },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
});

it("resolves app help and recovery links on the production root", () => {
  expect(websiteUrl()).toBe("https://repformed.com/#home");
  expect(websiteUrl("#contact")).toBe("https://repformed.com/#contact");
  expect(websiteUrl("account-help.html")).toBe(
    "https://repformed.com/account-help.html",
  );
  expect(websiteUrl("/?flow=recovery#account")).toBe(
    "https://repformed.com/?flow=recovery#account",
  );
});

it("keeps web help on its deployment root or configured subdirectory", () => {
  const base = "https://review.example.test/project/";
  expect(websiteNavigationUrl("#customer-help", base)).toBe(
    base + "#customer-help",
  );
  expect(websiteNavigationUrl("account-help.html", base)).toBe(
    base + "account-help.html",
  );
  expect(websiteNavigationUrl("/?flow=recovery#account", base)).toBe(
    base + "?flow=recovery#account",
  );
  expect(() => websiteNavigationUrl("//outside.example.test", base)).toThrow(
    "Only the Repformed website",
  );
});

it("drops browser app-mode query without changing native website destinations", () => {
  vi.stubGlobal("window", {
    location: { href: "https://review.example.test/?source=app#app-help" },
  });
  expect(websiteNavigationUrl()).toBe("https://review.example.test/#home");
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  expect(websiteNavigationUrl("#customer-help")).toBe(
    "https://repformed.com/#customer-help",
  );
});

it("rejects external, credential-bearing and non-HTTPS destinations before opening them", async () => {
  const open = vi.fn();
  vi.stubGlobal("window", { open });
  for (const destination of [
    "https://coachbilliott.github.io/Player-Development-Site/",
    "https://repformed.com.evil.test/",
    "//evil.test/",
    "http://repformed.com/",
    "https://repformed.com:8443/",
    "https://user:password@repformed.com/",
    "javascript:alert(1)",
  ]) {
    await expect(openWebsite(destination)).rejects.toThrow(
      "Only the Repformed website",
    );
  }
  expect(open).not.toHaveBeenCalled();
  expect(AppLauncher.openUrl).not.toHaveBeenCalled();
});

it("opens website links externally in the browser with opener protection", async () => {
  const open = vi.fn();
  vi.stubGlobal("window", { open });
  await openWebsite("account-help.html");
  expect(open).toHaveBeenCalledWith(
    "https://repformed.com/account-help.html",
    "_blank",
    "noopener,noreferrer",
  );
});

it("checks the native launcher result rather than claiming an unsuccessful handoff worked", async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  vi.mocked(AppLauncher.openUrl).mockResolvedValueOnce({ completed: false });
  await expect(openWebsite("#contact")).rejects.toThrow("could not be opened");
  vi.mocked(AppLauncher.openUrl).mockResolvedValueOnce({ completed: true });
  await expect(openWebsite("#contact")).resolves.toBeUndefined();
  expect(AppLauncher.openUrl).toHaveBeenLastCalledWith({
    url: "https://repformed.com/#contact",
  });
});
