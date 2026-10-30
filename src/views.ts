import type { AccountRole } from "./roles";
export const isDemoPage = (page: string) =>
  [
    "demo",
    "onboarding",
    "today",
    "session",
    "library",
    "progress",
    "family-demo",
  ].includes(page);
export function navigationFor(
  page: string,
  role: AccountRole | null,
): [string, string][] {
  if (isDemoPage(page))
    return [
      ["demo", "Guided demo"],
      ["home", "Back to website"],
    ];
  if (
    [
      "workspace",
      "training",
      "training-assign",
      "training-access",
      "staff-settings",
      "staff-delivery",
      "account",
      "profiles",
      "interest",
      "content-review",
      "access",
      "member-library",
      "launch",
      "coach",
      "video-reviews",
      "workout-builder",
    ].includes(page) &&
    role
  ) {
    if (role === "owner" || role === "manager" || role === "coach")
      return [
        ["workspace", "Athletes"],
        ["training", "Training"],
        ["staff-settings", "Staff & settings"],
      ];
    return [
      ["workspace", role === "parent" ? "My family" : "My training"],
      ["member-library", "Training library"],
      ["account", "Account settings"],
    ];
  }
  return [
    ["home", "The platform"],
    ["membership", "Proposed packages"],
    ["staff", "Meet the staff"],
    ["contact", "Contact"],
  ];
}
