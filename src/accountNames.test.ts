import { expect, it } from "vitest";
import { normalizeAccountName } from "./accountNames";
it("accepts optional names and Unicode without guessing an identity", () => {
  expect(normalizeAccountName("  José 李  ")).toBe("José 李");
  expect(normalizeAccountName("   ")).toBeNull();
  expect(normalizeAccountName("😀".repeat(100))).toBe("😀".repeat(100));
});
it("rejects excessive length, controls and invisible format characters", () => {
  for (const value of [
    "a".repeat(101),
    "A\nB",
    "A\tB",
    "A\u0085B",
    "A\u200fB",
    "A\u2028B",
  ])
    expect(() => normalizeAccountName(value)).toThrow(/100 characters/);
});
