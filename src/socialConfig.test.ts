import { expect, it } from "vitest";
import { validSocialLinks } from "./socialConfig";

it("publishes only explicit supported HTTPS profiles, removing duplicates and unsafe links", () => {
  expect(
    validSocialLinks({
      links: [
        {
          platform: "Instagram",
          url: "https://www.instagram.com/fictional_test/",
        },
        { platform: "Instagram", url: "https://www.instagram.com/duplicate/" },
        { platform: "TikTok", url: "javascript:alert(1)" },
        { platform: "X", url: "https://x.com.evil.example/brand" },
        { platform: "X", url: "https://other.example@x.com/brand" },
        { platform: "Facebook", url: "http://facebook.com/brand" },
        { platform: "YouTube", url: "https://www.youtube.com/" },
        { platform: "Threads", url: "https://threads.com:8080/brand" },
        { platform: "Unknown", url: "https://example.com/brand" },
        { platform: "X", url: "https://x.com/fictional_test" },
        null,
      ],
    }),
  ).toEqual([
    { platform: "Instagram", url: "https://www.instagram.com/fictional_test/" },
    { platform: "X", url: "https://x.com/fictional_test" },
  ]);
});

it("leaves absent and malformed social configuration unpublished", () => {
  for (const value of [
    null,
    {},
    { links: null },
    { links: [] },
    { links: ["@guess"] },
  ]) {
    expect(validSocialLinks(value)).toEqual([]);
  }
});
