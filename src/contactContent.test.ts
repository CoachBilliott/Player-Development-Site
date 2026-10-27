import { expect, it } from "vitest";
import { CONTACT_EMAIL, contactEmailLink } from "./contactContent";

it("addresses the approved inbox and encodes the selected question topic as one subject", () => {
  const link = new URL(contactEmailLink("Account and login help"));
  expect(link.protocol).toBe("mailto:");
  expect(link.pathname).toBe(CONTACT_EMAIL);
  expect(link.searchParams.get("subject")).toBe(
    "Repformed — Account and login help",
  );
  expect([...link.searchParams.keys()]).toEqual(["subject"]);
});

it("does not allow unknown topics to inject additional email headers or recipients", () => {
  for (const value of [
    "",
    "Privacy\r\nBcc: other@example.test",
    "?bcc=other@example.test",
    "mailto:other@example.test",
  ]) {
    const link = new URL(contactEmailLink(value));
    expect(link.pathname).toBe(CONTACT_EMAIL);
    expect(link.searchParams.get("subject")).toBe(
      "Repformed — General training questions",
    );
    expect([...link.searchParams.keys()]).toEqual(["subject"]);
  }
});
