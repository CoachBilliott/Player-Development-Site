/** Newer Auth events always take precedence over an older asynchronous read. */
export function createSessionRestoration<T>(onChange: (value: T) => void) {
  let revision = 0;
  return {
    observe(value: T) {
      revision++;
      onChange(value);
    },
    async restore(read: () => Promise<T>) {
      const requested = ++revision;
      const value = await read();
      if (requested === revision) onChange(value);
    },
  };
}
