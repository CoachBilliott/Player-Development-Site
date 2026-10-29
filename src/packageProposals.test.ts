import { expect, it } from "vitest";
import { packageInterestLink, PACKAGE_PROPOSALS } from "./packageProposals";

it("unknown package selections cannot inject recipients or email headers", () => {
  for (const value of [
    "",
    "Elite\r\nBcc: other@example.test",
    "?bcc=other@example.test",
    "mailto:other@example.test",
  ]) {
    const link = new URL(packageInterestLink(value));
    expect(link.pathname).toBe("Repformed@gmail.com");
    expect([...link.searchParams.keys()].sort()).toEqual(["body", "subject"]);
    expect(link.searchParams.get("body")).toContain(
      "Interested package: Not sure yet",
    );
    expect(link.searchParams.get("body")).not.toContain("other@example.test");
  }
});

it("the approved annual savings equal twelve monthly payments minus the annual price", () => {
  expect(
    PACKAGE_PROPOSALS.map((p) => [p.monthly, p.annual, p.annualSavings]),
  ).toEqual([
    ["9.99", "99", "20.88"],
    ["19.99", "199", "40.88"],
    ["39.99", "399", "80.88"],
    ["69.99", "699", "140.88"],
  ]);
  for (const p of PACKAGE_PROPOSALS)
    expect((Number(p.monthly) * 12 - Number(p.annual)).toFixed(2)).toBe(
      p.annualSavings,
    );
});
