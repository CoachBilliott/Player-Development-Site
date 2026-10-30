import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckName, Receipt } from "./policy";
import {
  rosterScope,
  rosterPages,
  rosterDetails,
  anonymousRoster,
  type Actor,
  type ProbeResult,
} from "./rosterProbe";
export function RosterChecks({
  client,
  anonymous,
  actor,
  busy,
  run,
  observe,
}: {
  client: SupabaseClient;
  anonymous: SupabaseClient;
  actor: Actor | null;
  busy: boolean;
  observe: (name: CheckName, result: Receipt["result"]) => void;
  run: (name: CheckName, action: () => Promise<Receipt["result"]>) => void;
}) {
  const [note, setNote] = useState("");
  function check(name: CheckName, action: () => Promise<ProbeResult>) {
    run(name, async () => {
      const result = await action();
      setNote(result.note);
      return result.result;
    });
  }
  return (
    <section aria-label="Migration 023 read-only roster acceptance">
      <h2>Migration 023 · roster acceptance</h2>
      <p>Search probe version 2 · authorized labels and redacted subchecks</p>
      <p>
        Uses this page's ordinary signed-in SDK client and the existing three
        adult fixtures only. Keep learning and all automation flags OFF. Run
        scope first, then paging and direct detail checks. No setup, assignment,
        role or data writes.
      </p>
      <button
        disabled={busy || !actor}
        onClick={() =>
          actor && check("roster scope", () => rosterScope(client, actor))
        }
      >
        Check signed-in roster scope
      </button>
      <button
        disabled={
          busy || !actor || !["owner", "manager", "coach"].includes(actor.role)
        }
        onClick={() =>
          actor &&
          check("roster pages and filters", () =>
            rosterPages(client, actor, observe),
          )
        }
      >
        Check roster paging and filters
      </button>
      <button
        disabled={busy || !actor}
        onClick={() =>
          actor &&
          check("roster direct details", () => rosterDetails(client, actor))
        }
      >
        Check direct athlete detail scope
      </button>
      <button
        disabled={busy}
        onClick={() =>
          check("anonymous roster", () => anonymousRoster(anonymous))
        }
      >
        Check anonymous roster denial
      </button>
      {note && <p role="status">{note}</p>}
      <p>
        Missing migration, expired session or network failure is blocked, never
        a permission pass. Sign out before another role; this panel clears on
        role changes. Receipts contain only check name, verified role, outcome
        and time. Hosted UI navigation, large-data load and changed-assignment
        tests remain separate.
      </p>
    </section>
  );
}
