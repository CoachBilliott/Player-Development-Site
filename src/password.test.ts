import { describe, expect, it } from "vitest";
import { passwordIssue, PASSWORD_REQUIREMENTS } from "./password";

describe("new password policy", () => {
  it.each([
    "Aa1!bbbb",
    "Aa1:bbbb",
    "Aa1\\bbbb",
    "Aa1 bbbb!",
    "Longer-valid-Password42!",
  ])("accepts an allowed password: %s", (password) => {
    expect(passwordIssue(password)).toBe("");
  });
  it.each([
    "Aa1!bbb",
    "aa1!bbbb",
    "AA1!BBBB",
    "Aa!!bbbb",
    "Aa12bbbb",
    "Aa1 bbbb",
    "",
    "        ",
    "Aa1😀bbbb",
  ])("rejects a short password or missing required group: %s", (password) => {
    expect(passwordIssue(password)).toBe(PASSWORD_REQUIREMENTS);
  });
});
