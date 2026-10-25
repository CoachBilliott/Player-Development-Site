import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { listAccess, isStaff, type AccessMember } from "./roles";
import type { SharedState } from "./useSharedContent";
import { Modal, Notice } from "./components";
const schema = z.object({
  resource_ids: z.array(z.string().uuid()),
  video_review_enabled: z.boolean(),
  review_coach_id: z.string().uuid().nullable(),
  version: z.number().int(),
});
type Access = z.infer<typeof schema>;
const empty: Access = {
  resource_ids: [],
  video_review_enabled: false,
  review_coach_id: null,
  version: 0,
};
export function TrainingAccess({ shared }: { shared: SharedState }) {
  const client = shared.service!.client;
  const [members, setMembers] = useState<AccessMember[]>([]),
    [account, setAccount] = useState(() => {
      try {
        const raw = sessionStorage.getItem("pd-service-access-target");
        if (!raw) return "";
        const target = z
          .object({ actor: z.string().uuid(), account: z.string().uuid() })
          .parse(JSON.parse(raw));
        return target.actor === shared.session?.user.id ? target.account : "";
      } catch {
        return "";
      }
    }),
    [value, setValue] = useState<Access>(empty),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    try {
      sessionStorage.removeItem("pd-service-access-target");
    } catch {
      /* This handoff is optional; server authorization remains required. */
    }
  }, []);
  useEffect(() => {
    let active = true;
    void listAccess(client, "")
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [client]);
  useEffect(() => {
    let active = true;
    if (account)
      void client
        .from("member_training_access")
        .select("resource_ids,video_review_enabled,review_coach_id,version")
        .eq("account_id", account)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!active) return;
          const parsed = schema.safeParse(data || empty);
          if (error || !parsed.success)
            setError(
              "Training access could not be loaded. Choose the account again to retry.",
            );
          else {
            setValue(parsed.data);
            setLoaded(true);
          }
        });
    return () => {
      active = false;
    };
  }, [client, account]);
  const resources = shared.resources.filter(
    (d) => d.visibility === "member_only",
  );
  return (
    <section
      className="panel training-access"
      aria-label="Workout and video package access"
    >
      <h2>Workouts & video review access</h2>
      <p>
        Assign uploaded workouts and optionally enable private video review.
        These are manual pilot permissions, ready to connect to future packages.
        Saving does not charge a customer or start a subscription.
      </p>
      <label>
        Customer account
        <select
          value={account}
          disabled={busy}
          onChange={(e) => {
            setLoaded(false);
            setValue(empty);
            setError("");
            setMessage("");
            setAccount(e.target.value);
          }}
        >
          <option value="">Choose a verified account</option>
          {members
            .filter((m) => m.email_verified && m.adult_setup)
            .map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.email}
              </option>
            ))}
        </select>
      </label>
      {error && !confirm && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {account && !loaded && !error && (
        <p role="status">Loading assigned training…</p>
      )}
      {loaded && (
        <>
          <fieldset disabled={busy}>
            <legend>Assigned workouts</legend>
            {!resources.length && (
              <p>Upload and publish a protected workout in Content first.</p>
            )}
            {resources.map((d) => (
              <label className="checkbox-label" key={d.id}>
                <input
                  type="checkbox"
                  checked={value.resource_ids.includes(d.id)}
                  onChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      resource_ids: e.target.checked
                        ? [...v.resource_ids, d.id]
                        : v.resource_ids.filter((id) => id !== d.id),
                    }))
                  }
                />
                {d.title}
              </label>
            ))}
          </fieldset>
          <p className="member-fineprint">
            Athletes only see assigned drills that match their age, position and
            experience. Public demo samples stay separate.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              disabled={busy}
              checked={value.video_review_enabled}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  video_review_enabled: e.target.checked,
                }))
              }
            />
            Enable the optional video review feature
          </label>
          {value.video_review_enabled && (
            <label>
              Assigned review coach
              <select
                value={value.review_coach_id || ""}
                disabled={busy}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    review_coach_id: e.target.value || null,
                  }))
                }
              >
                <option value="">Choose a coach</option>
                {members
                  .filter((m) => isStaff(m.role))
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.email}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="button"
            disabled={
              busy || (value.video_review_enabled && !value.review_coach_id)
            }
            onClick={() => setConfirm(true)}
          >
            Review training access
          </button>
          <Notice>
            Video review stays private to the family and the currently assigned
            coach. Real junior media remains closed. Future paid access must be
            enforced by a server billing integration.
          </Notice>
        </>
      )}
      {confirm && (
        <Modal
          title="Save training access?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>{members.find((m) => m.user_id === account)?.email}</p>
          <p>
            {value.resource_ids.length} assigned workouts · Video review{" "}
            {value.video_review_enabled ? "enabled" : "disabled"}
          </p>
          <p>No payment or subscription will be started.</p>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  const { data, error } = await client.rpc(
                    "set_member_training_access",
                    {
                      target_account: account,
                      resources: value.resource_ids,
                      video_enabled: value.video_review_enabled,
                      coach: value.video_review_enabled
                        ? value.review_coach_id
                        : null,
                      expected_version: value.version,
                    },
                  );
                  if (error)
                    throw new Error(
                      "Save was not confirmed. Reload this account before retrying; another Owner may have changed it.",
                    );
                  setValue(schema.parse(data));
                  setConfirm(false);
                  setMessage(
                    "Training access saved. This account will see the changes after refreshing.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              Save training access
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep editing
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
