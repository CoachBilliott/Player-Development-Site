import { describe, expect, it, vi } from "vitest";
import { keychainStorage } from "./nativeStorage";
import { mobileNavigation } from "./mobile";

describe("native credential storage", () => {
  it("scopes session keys and round-trips only through the secure store", async () => {
    const values = new Map<string, string>();
    const store = {
      get: vi.fn(async ({ key }: { key: string }) => {
        if (!values.has(key))
          throw new Error("Item with given key does not exist");
        return { value: values.get(key)! };
      }),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        values.set(key, value);
        return { value: true };
      }),
      remove: vi.fn(async ({ key }: { key: string }) => ({
        value: values.delete(key),
      })),
    };
    const storage = keychainStorage(store);
    expect(await storage.getItem("session")).toBeNull();
    await storage.setItem("session", "fictional-session");
    expect(values.get("pd-native:session")).toBe("fictional-session");
    expect(await storage.getItem("session")).toBe("fictional-session");
    await storage.removeItem("session");
    expect(await storage.getItem("session")).toBeNull();
  });
  it("propagates genuine device errors instead of treating them as missing data", async () => {
    const store = {
      get: vi.fn().mockRejectedValue(new Error("Device locked")),
      set: vi.fn().mockResolvedValue({ value: false }),
      remove: vi.fn().mockRejectedValue(new Error("Keychain unavailable")),
    };
    const storage = keychainStorage(store);
    await expect(storage.getItem("session")).rejects.toThrow("Device locked");
    await expect(storage.setItem("session", "fixture")).rejects.toThrow(
      "securely",
    );
    await expect(storage.removeItem("session")).rejects.toThrow(
      "Keychain unavailable",
    );
  });
  it("allows an already absent sign-out key without clearing other credentials", async () => {
    const remove = vi
      .fn()
      .mockRejectedValue(new Error("Item with given key does not exist"));
    await expect(
      keychainStorage({ get: vi.fn(), set: vi.fn(), remove }).removeItem(
        "session",
      ),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ key: "pd-native:session" });
  });
});
it("offers staff content tabs only for authenticated staff roles", () => {
  for (const role of ["parent", "athlete", null] as const)
    expect(mobileNavigation(true, role).map(([page]) => page)).not.toContain(
      "coach",
    );
  for (const role of ["owner", "manager", "coach"] as const)
    expect(mobileNavigation(true, role).map(([page]) => page)).toContain(
      "coach",
    );
  expect(mobileNavigation(false, "owner").map(([page]) => page)).not.toContain(
    "coach",
  );
});
