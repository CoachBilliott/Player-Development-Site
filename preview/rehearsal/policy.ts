export const TEST_REF = "ojcfrfpeftvngyluomex";
export const TEST_URL = `https://${TEST_REF}.supabase.co`;
export const TEST_ACCOUNTS = [
  "owner",
  "manager",
  "coach",
  "other-coach",
  "parent",
  "other-parent",
].map((role) => `repformed-learning-${role}@example.test`);
export const SAMPLE_TEXT =
  "REPFORMED REHEARSAL ONLY\nOriginal synthetic adult lesson. No real athlete information.\n";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function publicTestKey(input: string) {
  const key = input.trim();
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return key;
  try {
    const parts = key.split(".");
    if (parts.length !== 3) throw Error();
    const base = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(base.padEnd(Math.ceil(base.length / 4) * 4, "=")),
    );
    if (payload.role === "anon" && payload.ref === TEST_REF) return key;
  } catch {
    /* Reject without echoing a supplied credential. */
  }
  throw Error(
    "Use only this test project's public publishable/anon key. Privileged or user-session keys are rejected.",
  );
}
export function testFetch(nativeFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      url.origin !== TEST_URL ||
      url.username ||
      url.password ||
      !/^\/(auth\/v1\/(token|user|logout)(\/|$)|rest\/v1\/|storage\/v1\/)/.test(
        url.pathname,
      )
    ) {
      throw Error(
        "Only the approved test project's Auth, REST and Storage endpoints are permitted.",
      );
    }
    return nativeFetch(input, {
      ...init,
      cache: "no-store",
      credentials: "omit",
    });
  };
}
export function syntheticAccount(email: string) {
  return TEST_ACCOUNTS.includes(email);
}
export function samplePath(path: string) {
  const parts = path.trim().split("/");
  return (
    parts.length === 3 &&
    UUID.test(parts[0]) &&
    UUID.test(parts[1]) &&
    UUID.test(parts[2].replace(/\.txt$/, "")) &&
    parts[2].endsWith(".txt")
  );
}
export function learnerKeysAbsent(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, child]) =>
      !["keys", "correct", "correct_answer", "answer_key"].includes(key) &&
      learnerKeysAbsent(child),
  );
}
export type CheckName =
  | "verified sign-in"
  | "raw keys"
  | "anonymous keys"
  | "tampered JWT"
  | "profile allow"
  | "profile deny"
  | "sample upload"
  | "media allow"
  | "media deny";
export type Receipt = {
  check: CheckName;
  role: string;
  result: "passed" | "failed" | "blocked";
  at: string;
};
// Export only these fixed fields. Never serialize clients, auth responses,
// passwords, session tokens, signed URLs, answers or uploaded file contents.
export function receiptJson(rows: Receipt[]) {
  return JSON.stringify(
    {
      project: TEST_REF,
      scope: "test-only manual acceptance",
      checks: rows.map(({ check, role, result, at }) => ({
        check,
        role,
        result,
        at,
      })),
    },
    null,
    2,
  );
}
