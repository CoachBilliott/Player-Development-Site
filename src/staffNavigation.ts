export function trainingUrl(
  route: string,
  values: Record<string, string> = {},
) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  url.hash = route;
  return `${url.search}${url.hash}`;
}
