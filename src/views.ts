import type { AccountRole } from "./roles";
export type PreviewView =
  "owner" | "manager" | "coach" | "parent" | "athlete" | "junior";
export const PREVIEW_VIEWS: PreviewView[] = [
  "owner",
  "manager",
  "coach",
  "parent",
  "athlete",
  "junior",
];
export const VIEW_LABELS: Record<PreviewView, string> = {
  owner: "Owner",
  manager: "Manager",
  coach: "Coach",
  parent: "Parent",
  athlete: "Adult athlete",
  junior: "Junior athlete",
};
export const isDemoPage = (page: string) =>
  [
    "demo",
    "onboarding",
    "today",
    "session",
    "library",
    "progress",
    "family-demo",
  ].includes(page) || page.startsWith("demo-");
export function navigationFor(
  page: string,
  role: AccountRole | null,
): [string, string][] {
  if (isDemoPage(page))
    return [
      ["demo", "Demo views"],
      ["today", "Demo training"],
      ["library", "Sample drills"],
      ["progress", "Demo history"],
    ];
  if (
    [
      "workspace",
      "account",
      "access",
      "member-library",
      "launch",
      "coach",
    ].includes(page) &&
    role
  ) {
    if (role === "owner")
      return [
        ["workspace", "Overview"],
        ["coach", "Upload & content"],
        ["access", "Account access"],
      ];
    if (role === "manager" || role === "coach")
      return [
        ["workspace", "Overview"],
        ["coach", "Upload & content"],
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
    ["demo", "Try the demo"],
    ["membership", "Memberships"],
  ];
}
