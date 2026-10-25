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
      "account",
      "access",
      "member-library",
      "launch",
      "coach",
      "video-reviews",
      "workout-builder",
    ].includes(page) &&
    role
  ) {
    if (role === "owner")
      return [
        ["workspace", "Overview"],
        ["coach", "Upload & content"],
        ["video-reviews", "Video reviews"],
        ["access", "Account access"],
      ];
    if (role === "manager" || role === "coach")
      return [
        ["workspace", "Overview"],
        ["coach", "Upload & content"],
        ["video-reviews", "Video reviews"],
        ["member-library", "Content library"],
      ];
    return [
      ["workspace", role === "parent" ? "My family" : "My training"],
      ["member-library", "Training library"],
      ["account", "Account settings"],
    ];
  }
  return [
    ["home", "The platform"],
    ["membership", "Memberships"],
  ];
}
