export const INTEREST_PACKAGES = [
  "undecided",
  "foundation",
  "fundamentals",
  "position-development",
  "elite-coaching",
] as const;
export type InterestPackage = (typeof INTEREST_PACKAGES)[number];
export const LAUNCH_NOTICE_VERSION = "repformed-launch-notice-v1" as const;
export const LAUNCH_NOTICE_TEXT = "Email me when Repformed launches";
export const LAUNCH_NOTICE_NOTE =
  "Optional. Leaving this unchecked does not add permission or cancel an earlier request.";
export type InterestSubmission = {
  id: string;
  name: string;
  email: string;
  packageInterest: InterestPackage;
  adult: true;
  website: string;
  launchUpdates: boolean;
  launchNoticeVersion: typeof LAUNCH_NOTICE_VERSION | null;
};
export function parseInterestSubmission(
  raw: unknown,
): InterestSubmission | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "id",
          "name",
          "email",
          "packageInterest",
          "adult",
          "website",
          "launchUpdates",
          "launchNoticeVersion",
        ].includes(k),
    )
  )
    return null;
  if (
    typeof v.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      v.id,
    ) ||
    typeof v.email !== "string" ||
    v.adult !== true ||
    (v.name !== undefined && typeof v.name !== "string") ||
    (v.website !== undefined && v.website !== "") ||
    !INTEREST_PACKAGES.includes(v.packageInterest as InterestPackage) ||
    (v.launchUpdates !== undefined && typeof v.launchUpdates !== "boolean") ||
    (v.launchNoticeVersion !== undefined &&
      v.launchNoticeVersion !== null &&
      v.launchNoticeVersion !== LAUNCH_NOTICE_VERSION) ||
    (v.launchUpdates === true &&
      v.launchNoticeVersion !== LAUNCH_NOTICE_VERSION)
  )
    return null;
  const email = v.email.trim().toLowerCase();
  const name = ((v.name as string | undefined) || "").trim();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    name.length > 60 ||
    Array.from(name).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    return null;
  return {
    id: v.id,
    name,
    email,
    packageInterest: v.packageInterest as InterestPackage,
    adult: true,
    website: "",
    launchUpdates: v.launchUpdates === true,
    launchNoticeVersion:
      v.launchNoticeVersion === LAUNCH_NOTICE_VERSION
        ? LAUNCH_NOTICE_VERSION
        : null,
  };
}
