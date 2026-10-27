import { Capacitor } from "@capacitor/core";
import type { AccountRole } from "./roles";

export const WEBSITE =
  "https://coachbilliott.github.io/Player-Development-Site/";
export const nativeApp = () => Capacitor.isNativePlatform();
export function appSurface() {
  return (
    nativeApp() ||
    new URLSearchParams(window.location.search).get("source") === "app" ||
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}
export function mobileNavigation(signedIn: boolean, role: AccountRole | null) {
  if (!signedIn)
    return [
      ["app", "Start"],
      ["account", "Log in"],
      ["app-help", "Help"],
    ] as const;
  if (role === "owner" || role === "manager" || role === "coach")
    return [
      ["workspace", "Overview"],
      ["coach", "Content"],
      ["video-reviews", "Reviews"],
      ["account", "Account"],
      ["app-help", "Help"],
    ] as const;
  return [
    ["workspace", "Today"],
    ["app-workouts", "Workouts"],
    ["app-progress", "Progress"],
    ["account", "Account"],
  ] as const;
}
export async function openWebsite(path = "#home") {
  const url = new URL(path, WEBSITE);
  if (
    url.origin !== new URL(WEBSITE).origin ||
    !url.pathname.startsWith("/Player-Development-Site/")
  )
    throw new Error("Only the Repformed website can be opened here.");
  if (nativeApp()) {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    const result = await AppLauncher.openUrl({ url: url.href });
    if (!result.completed)
      throw new Error(
        "The website could not be opened. Please open it in Safari.",
      );
  } else window.open(url.href, "_blank", "noopener,noreferrer");
}
