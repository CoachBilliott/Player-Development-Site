import { Capacitor } from "@capacitor/core";

type SecureStore = {
  get(options: { key: string }): Promise<{ value: string }>;
  set(options: { key: string; value: string }): Promise<{ value: boolean }>;
  remove(options: { key: string }): Promise<{ value: boolean }>;
};
const missing = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)) ===
  "Item with given key does not exist";

/** Native sessions use the OS credential store; never downgrade to browser storage. */
export function keychainStorage(store: SecureStore) {
  const scoped = (key: string) => `pd-native:${key}`;
  return {
    async getItem(key: string) {
      try {
        return (await store.get({ key: scoped(key) })).value;
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async setItem(key: string, value: string) {
      if (!(await store.set({ key: scoped(key), value })).value)
        throw new Error(
          "The device could not save the sign-in session securely.",
        );
    },
    async removeItem(key: string) {
      try {
        if (!(await store.remove({ key: scoped(key) })).value)
          throw new Error("The device could not remove the sign-in session.");
      } catch (error) {
        if (!missing(error)) throw error;
      }
    },
  };
}
export async function nativeAuthStorage() {
  if (!Capacitor.isNativePlatform()) return undefined;
  const { SecureStoragePlugin } =
    await import("capacitor-secure-storage-plugin");
  return keychainStorage(SecureStoragePlugin);
}
