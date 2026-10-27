import { expect, it } from "vitest";
import { packageInterestLink } from "./packageProposals";

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
