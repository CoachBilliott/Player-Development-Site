import { expect, it, vi } from "vitest";
import { createSessionRestoration } from "./sessionRestoration";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
it("restores a session when no newer Auth event occurred", async () => {
  const change = vi.fn();
  const state = createSessionRestoration<string | null>(change);
  await state.restore(async () => "adult-one");
  expect(change).toHaveBeenLastCalledWith("adult-one");
});
it("a sign-out cannot be undone by a pending session restoration", async () => {
  const change = vi.fn();
  const state = createSessionRestoration<string | null>(change),
    read = deferred<string | null>();
  const pending = state.restore(() => read.promise);
  state.observe(null);
  read.resolve("old-owner");
  await pending;
  expect(change.mock.calls).toEqual([[null]]);
});
it("an account switch cannot be overwritten by an earlier user's read", async () => {
  const change = vi.fn();
  const state = createSessionRestoration<string | null>(change),
    read = deferred<string | null>();
  const pending = state.restore(() => read.promise);
  state.observe("new-athlete");
  read.resolve("old-owner");
  await pending;
  expect(change.mock.calls).toEqual([["new-athlete"]]);
});
it("the newer of two asynchronous restores wins", async () => {
  const change = vi.fn();
  const state = createSessionRestoration<string | null>(change),
    read = deferred<string | null>();
  const old = state.restore(() => read.promise);
  await state.restore(async () => "new-parent");
  read.resolve("old-owner");
  await old;
  expect(change.mock.calls).toEqual([["new-parent"]]);
});
