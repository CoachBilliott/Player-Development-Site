import { expect, it } from "vitest";
import { previewShared } from "../preview/private/fixtures";
import { listAccess, listNamedAccess, type AccountRole } from "./roles";
import { loadAccountName, saveAccountName } from "./accountNames";

it("read-only preview preserves v1 directory and adds the same Owner-only v2 scope with missing names", async () => {
  const client = previewShared("owner", () => {}).service!.client;
  for (const search of ["", "manager", "family", "no-match"]) {
    const old = await listAccess(client, search);
    const named = await listNamedAccess(client, search);
    expect(
      named.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "display_name"),
        ),
      ),
    ).toEqual(old);
    expect(named.every((row) => row.display_name === null)).toBe(true);
  }
  expect(await listAccess(client, "owner")).toHaveLength(1);
});
for (const role of ["manager", "coach", "parent", "athlete", null] as const) {
  it(`preview ${role || "visitor"} cannot read either Owner directory`, async () => {
    const client = previewShared(role as AccountRole | null, () => {}).service!
      .client;
    await expect(listAccess(client, "")).rejects.toThrow(/Owner access/);
    await expect(listNamedAccess(client, "")).rejects.toThrow(/Owner access/);
  });
}
it("preview name reads show the optional field but writes always fail without mutating fictional state", async () => {
  const shared = previewShared("owner", () => {}),
    client = shared.service!.client;
  const before = await loadAccountName(client);
  expect(before).toEqual({ eligible: true, display_name: null, version: 0 });
  await expect(
    saveAccountName(
      client,
      "Fictional review-only draft",
      0,
      shared.session!.user.id,
    ),
  ).rejects.toThrow(/not confirmed saved/);
  expect(await loadAccountName(client)).toEqual(before);
  expect(
    await loadAccountName(previewShared("manager", () => {}).service!.client),
  ).toEqual(before);
});
