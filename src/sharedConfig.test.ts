import { describe, expect, it } from "vitest";
import { parseSharedConfig } from "./sharedContent";
const config = {
  enabled: true,
  url: "https://separate-demo.supabase.co",
  publishableKey: "sb_publishable_demo",
};
describe("shared publishing configuration", () => {
  it("keeps shared publishing disabled without contacting a service", () => {
    expect(
      parseSharedConfig({ enabled: false, url: "", publishableKey: "" }),
    ).toBeNull();
  });
  it("accepts a public project key", () =>
    expect(parseSharedConfig(config)).toEqual({
      url: config.url,
      publishableKey: config.publishableKey,
    }));
  it("rejects secret and service-role credentials", () => {
    for (const publishableKey of [
      "sb_secret_do-not-expose",
      `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`,
      "not-a-key",
    ])
      expect(() => parseSharedConfig({ ...config, publishableKey })).toThrow(
        /public publishable or anon key/,
      );
  });
  it("rejects untrusted or insecure project endpoints", () => {
    for (const url of [
      "http://separate-demo.supabase.co",
      "https://supabase.co.evil.test",
      "https://separate-demo.supabase.co/private",
      "https://name:password@separate-demo.supabase.co",
    ])
      expect(() => parseSharedConfig({ ...config, url })).toThrow();
  });
  it("accepts a legacy anon key without accepting its secret equivalent", () => {
    const publishableKey = `header.${btoa(JSON.stringify({ role: "anon" }))}.signature`;
    expect(parseSharedConfig({ ...config, publishableKey })).not.toBeNull();
  });
});
