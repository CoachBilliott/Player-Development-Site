import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountLifecycle } from "./accountLifecycle";
const id = "a4000000-0000-4000-8000-000000000001",
  requestId = "a4000000-0000-4000-8000-000000000002";
it("binds deletion to the displayed identity and that password-authenticated token", async () => {
  const invoke = vi.fn(async () => ({
    data: { deleted: true, requestId, receiptSaved: true },
    error: null,
  }));
  const signInWithPassword = vi.fn(async () => ({
    data: { user: { id }, session: { access_token: "fictional-reauth-token" } },
    error: null,
  }));
  const service = new AccountLifecycle({
    auth: { signInWithPassword },
    functions: { invoke },
  } as unknown as SupabaseClient);
  await service.deleteAccount(
    requestId,
    id,
    "fictional@example.test",
    "fictional-password",
  );
  expect(invoke).toHaveBeenCalledWith("account-lifecycle", {
    body: { action: "delete", requestId, confirmation: "DELETE" },
    headers: { Authorization: "Bearer fictional-reauth-token" },
  });
});
it("does not issue deletion for an unexpected reauthenticated identity", async () => {
  const invoke = vi.fn();
  const service = new AccountLifecycle({
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: {
          user: { id: "someone-else" },
          session: { access_token: "fictional" },
        },
        error: null,
      })),
    },
    functions: { invoke },
  } as unknown as SupabaseClient);
  await expect(
    service.deleteAccount(
      requestId,
      id,
      "fictional@example.test",
      "fictional-password",
    ),
  ).rejects.toThrow(/not confirmed for this account/);
  expect(invoke).not.toHaveBeenCalled();
});
it("keeps a failed server operation as a failure instead of accepting malformed success", async () => {
  const service = new AccountLifecycle({
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id }, session: { access_token: "fictional" } },
        error: null,
      })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: { deleted: false }, error: null })),
    },
  } as unknown as SupabaseClient);
  await expect(
    service.deleteAccount(
      requestId,
      id,
      "fictional@example.test",
      "fictional-password",
    ),
  ).rejects.toThrow();
});
