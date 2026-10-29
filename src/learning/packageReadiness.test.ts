import { describe, expect, it } from "vitest";
import { packageRequirements, pairedQuizIds } from "./packageReadiness";
describe("draft weekly allocation preview", () => {
  it.each([
    ["foundation", 0, 0],
    ["fundamentals", 2, 0],
    ["position-development", 2, 2],
    ["elite-coaching", 2, 2],
  ])("uses the official additive workload for %s", (id, movement, position) => {
    expect(packageRequirements([String(id)])).toEqual({
      mode: "package",
      iq: 2,
      quizzes: 2,
      movement,
      position,
    });
  });
  it("allows Position and Elite to share the same weekly content", () => {
    expect(
      packageRequirements(["position-development", "elite-coaching"]),
    ).toEqual(packageRequirements(["elite-coaching"]));
  });
  it.each([
    [],
    ["unknown"],
    ["foundation", "fundamentals"],
    ["private_test", "foundation"],
  ])(
    "does not certify incompatible or absent package selection %j",
    (...ids) => {
      expect(packageRequirements(ids as string[]).mode).toBe("invalid");
    },
  );
  it("keeps explicitly private test content distinct from a package", () => {
    expect(packageRequirements(["private_test"])).toMatchObject({
      mode: "test",
    });
  });
  it("pairs only selected IQ lessons; the server independently rejects reused quiz links", () => {
    expect(
      pairedQuizIds(["a", "b", "c", "d"], {
        a: { kind: "iq", quiz_version_id: "q1" },
        b: { kind: "iq", quiz_version_id: "q1" },
        c: { kind: "movement", quiz_version_id: "q2" },
        d: { kind: "iq" },
        unselected: { kind: "iq", quiz_version_id: "q3" },
      }),
    ).toEqual(["q1"]);
  });
});
