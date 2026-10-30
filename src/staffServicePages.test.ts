import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StaffService } from "./staffService";
const id = "93000000-0000-4000-8000-000000000001";
const row = {
  client_id: id,
  client_label: "Fictional adult",
  athlete_id: id,
  athlete_name: "Fictional athlete",
  next_action: "Review training",
};
const legacy = {
  source: "account_backend",
  scope: "all_repformed_clients",
  rows: [row],
  coaches: [],
};
const response = {
  ...legacy,
  page: {
    number: 1,
    size: 25,
    pages: 1,
    total: 1,
    matched: 1,
    athletes: 1,
    clients: 1,
    counts: { overdue: 0, attention: 1, ready: 0 },
    ages: ["18+"],
    positions: ["Quarterback"],
    coaches: [],
  },
};
const input = {
  search: "  fictional  ",
  status: "all" as const,
  age: "",
  position: "",
  coach: "",
  number: 1,
  size: 25,
};
function client(reply: unknown, error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data: reply, error });
  const rpc = vi.fn(() => ({ abortSignal }));
  return {
    api: new StaffService({ rpc } as unknown as SupabaseClient),
    rpc,
    abortSignal,
  };
}
it("paged reads send only validated filters/page arguments and use the request's abort signal", async () => {
  const c = client(response),
    signal = new AbortController().signal;
  const result = await c.api.rosterPage(input, signal);
  expect(c.rpc).toHaveBeenCalledWith("staff_client_service_roster_page", {
    search_text: "fictional",
    status_filter: "all",
    age_filter: "",
    position_filter: "",
    coach_filter: "",
    page_number: 1,
    page_size: 25,
  });
  expect(c.abortSignal).toHaveBeenCalledWith(signal);
  expect(result.rows[0].athlete_id).toBe(id);
});
it("invalid inputs do not contact the backend", async () => {
  const c = client(response);
  await expect(
    c.api.rosterPage({ ...input, size: 101 }, new AbortController().signal),
  ).rejects.toThrow(/valid roster filters/);
  expect(c.rpc).not.toHaveBeenCalled();
});
it("inconsistent server counts/row limits fail clearly rather than pretending a valid roster loaded", async () => {
  for (const page of [
    { ...response.page, total: 0 },
    { ...response.page, pages: 4 },
    { ...response.page, matched: 0 },
    { ...response.page, number: 2 },
  ]) {
    const c = client({ ...response, page });
    await expect(
      c.api.rosterPage(input, new AbortController().signal),
    ).rejects.toThrow("The roster response could not be verified");
    expect(c.rpc).toHaveBeenCalledTimes(1);
  }
});
it("only the explicit missing-function capability falls back to the existing scoped service for rollback", async () => {
  const pageAbort = vi.fn().mockResolvedValue({
    data: null,
    error: { code: "PGRST202", message: "Missing function" },
  });
  const legacyAbort = vi.fn().mockResolvedValue({ data: legacy, error: null });
  const rpc = vi.fn((name: string) => ({
    abortSignal:
      name === "staff_client_service_roster_page" ? pageAbort : legacyAbort,
  }));
  const signal = new AbortController().signal;
  const api = new StaffService({ rpc } as unknown as SupabaseClient);
  const result = await api.rosterPage(input, signal);
  expect(result.rows[0].athlete_id).toBe(id);
  expect("page" in result).toBe(false);
  expect(rpc.mock.calls.map((x) => x[0])).toEqual([
    "staff_client_service_roster_page",
    "staff_client_service_roster",
  ]);
  expect(legacyAbort).toHaveBeenCalledWith(signal);
});
it("authorization failures and server errors never route around the denied/new endpoint", async () => {
  for (const code of ["42501", "PGRST301", "XX000"]) {
    const c = client(null, { code, message: "Denied or failed" });
    await expect(
      c.api.rosterPage(input, new AbortController().signal),
    ).rejects.toThrow(/could not be loaded/);
    expect(c.rpc).toHaveBeenCalledTimes(1);
  }
});
it("weekly pages carry the same cancellation signal without selecting the numeric API", async () => {
  const c = client({
    ...legacy,
    page: { ...response.page, next_cursor: null },
  });
  const signal = new AbortController().signal;
  const result = await c.api.page(
    { query: "", filter: "all", age: "", position: "", coach: "" },
    null,
    25,
    signal,
  );
  expect(result.page?.total).toBe(1);
  expect(c.rpc.mock.calls.map((x) => x[0])).toEqual([
    "staff_learning_roster_page",
  ]);
  expect(c.abortSignal).toHaveBeenCalledWith(signal);
});
it("missing weekly capability never downgrades to numeric or legacy service data", async () => {
  const c = client(null, {
    code: "PGRST202",
    message: "Missing learning capability",
  });
  await expect(
    c.api.page(
      { query: "", filter: "all", age: "", position: "", coach: "" },
      null,
      25,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Weekly service records could not be loaded");
  expect(c.rpc.mock.calls.map((x) => x[0])).toEqual([
    "staff_learning_roster_page",
  ]);
});
