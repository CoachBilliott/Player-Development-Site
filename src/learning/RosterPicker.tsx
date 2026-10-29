import { useEffect, useState } from "react";
import type { RosterCursor } from "../staffService";
export type PickerProfile = { id: string; name: string };
export type ProfilePage = {
  rows: PickerProfile[];
  next_cursor: RosterCursor | null;
};
export type ProfileLoader = (
  query: string,
  cursor: RosterCursor | null,
) => Promise<ProfilePage>;
const EMPTY_PROFILES: PickerProfile[] = [];
export function RosterPicker({
  profiles = EMPTY_PROFILES,
  knownProfiles = [],
  loadProfiles,
  value,
  onChange,
  disabled = false,
}: {
  profiles?: PickerProfile[];
  knownProfiles?: PickerProfile[];
  loadProfiles?: ProfileLoader;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState<RosterCursor | null>(null),
    [history, setHistory] = useState<(RosterCursor | null)[]>([]),
    [page, setPage] = useState<ProfilePage | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let live = true;
    const read = loadProfiles
      ? loadProfiles(search, cursor)
      : Promise.resolve(
          (() => {
            const rows = profiles.filter((p) =>
                p.name.toLowerCase().includes(search.toLowerCase()),
              ),
              offset = Number(cursor?.key.replace("local:", "") || 0);
            return {
              rows: rows.slice(offset, offset + 25),
              next_cursor:
                offset + 25 < rows.length
                  ? { priority: 2, label: "", key: "local:" + (offset + 25) }
                  : null,
            };
          })(),
        );
    void read
      .then((p) => {
        if (live) {
          setPage(p);
          setLabels((old) => ({
            ...old,
            ...Object.fromEntries(p.rows.map((r) => [r.id, r.name])),
          }));
          setError("");
        }
      })
      .catch((e) => {
        if (live) {
          setPage(null);
          setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, [loadProfiles, profiles, search, cursor, attempt]);
  function move(next: RosterCursor | null) {
    setPage(null);
    setCursor(next);
  }
  return (
    <section className="learning-roster-picker">
      <label>
        Find athletes
        <input
          type="search"
          maxLength={160}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHistory([]);
            setCursor(null);
            setPage(null);
          }}
        />
      </label>
      <p>{value.length} selected across all pages · maximum 500</p>
      {!page && !error && <p role="status">Loading athlete choices…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry athlete choices
          </button>
        </div>
      )}
      <div className="learning-actions">
        <button
          type="button"
          disabled={
            disabled ||
            !page?.rows.length ||
            value.length >= 500 ||
            page.rows.every((p) => value.includes(p.id))
          }
          onClick={() =>
            onChange(
              [
                ...new Set([...value, ...(page?.rows.map((p) => p.id) || [])]),
              ].slice(0, 500),
            )
          }
        >
          Select this page
        </button>
        <button
          type="button"
          disabled={disabled || !value.length}
          onClick={() => onChange([])}
        >
          Clear selected athletes
        </button>
      </div>
      <fieldset disabled={disabled}>
        <legend>Group athletes</legend>
        {page?.rows.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={value.includes(p.id)}
              disabled={
                disabled || (!value.includes(p.id) && value.length >= 500)
              }
              onChange={() =>
                onChange(
                  value.includes(p.id)
                    ? value.filter((id) => id !== p.id)
                    : [...value, p.id],
                )
              }
            />
            {p.name}
          </label>
        ))}
        {page && !page.rows.length && <p>No athletes match this search.</p>}
      </fieldset>
      <nav aria-label="Group athlete pages" className="learning-actions">
        <button
          type="button"
          disabled={disabled || !history.length || !page}
          onClick={() => {
            const previous = history.at(-1) || null;
            setHistory((h) => h.slice(0, -1));
            move(previous);
          }}
        >
          Previous athletes
        </button>
        <span>Page {history.length + 1}</span>
        <button
          type="button"
          disabled={disabled || !page?.next_cursor}
          onClick={() => {
            setHistory((h) => [...h, cursor]);
            move(page!.next_cursor);
          }}
        >
          Next athletes
        </button>
      </nav>
      {value.length > 0 && (
        <details>
          <summary>Review selected athletes</summary>
          <ul>
            {value.map((id) => (
              <li key={id}>
                {labels[id] ||
                  knownProfiles.find((p) => p.id === id)?.name ||
                  "Selected athlete"}{" "}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((x) => x !== id))}
                >
                  Remove{" "}
                  {labels[id] ||
                    knownProfiles.find((p) => p.id === id)?.name ||
                    "athlete"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
