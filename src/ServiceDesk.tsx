import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal, Tag } from "./components";
import {
  BLOCKERS,
  ReviewServices,
  SERVICE_LABELS,
  reviewDate,
  reviewTiming,
  type ReviewDesk,
  type ReviewService,
} from "./reviewServices";
import "./serviceDesk.css";
export function ServiceDesk({
  client,
  owner,
  onChange,
  actor,
  refreshKey,
}: {
  client: SupabaseClient;
  owner: boolean;
  actor: string;
  refreshKey: number;
  onChange: () => void;
}) {
  const api = useMemo(() => new ReviewServices(client), [client]);
  const [desk, setDesk] = useState<ReviewDesk | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [filter, setFilter] = useState("open"),
    [search, setSearch] = useState(""),
    [current, setCurrent] = useState<ReviewService | null>(null),
    [coach, setCoach] = useState(""),
    [blocker, setBlocker] = useState<ReviewService["blocker"]>("none");
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      void api
        .desk()
        .then((v) => {
          if (active) {
            setDesk(v);
            setError("");
            setNow(Date.now());
          }
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    load();
    window.addEventListener("focus", load);
    const timer = setInterval(() => {
      setNow(Date.now());
      load();
    }, 60000);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      clearInterval(timer);
    };
  }, [api, refreshKey]);
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const open = (desk?.requests || []).filter(
    (r) => !["delivered", "cancelled"].includes(r.state),
  );
  const overdue = open.filter((r) => r.due_at && Date.parse(r.due_at) <= now);
  const soon = open.filter(
    (r) =>
      r.due_at &&
      Date.parse(r.due_at) > now &&
      Date.parse(r.due_at) <= now + 12 * 3600000,
  );
  const rows = (desk?.requests || [])
    .filter(
      (r) =>
        filter === "all" ||
        (filter === "delivered" && r.state === "delivered") ||
        (filter === "overdue" && overdue.includes(r)) ||
        (filter === "open" && !["delivered", "cancelled"].includes(r.state)),
    )
    .filter((r) =>
      `${r.id} ${r.account_id} ${r.drill_title} ${SERVICE_LABELS[r.state]}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.due_at ? Date.parse(a.due_at) : Infinity) -
        (b.due_at ? Date.parse(b.due_at) : Infinity),
    );
  return (
    <section className="service-desk" aria-label="Service fulfillment tracker">
      <Tag>OWNER & MANAGER · SERVICE DESK</Tag>
      <h1 tabIndex={-1}>Every review. Followed through.</h1>
      <p>
        Track requests, assign a coach and deliver feedback within 48 hours of a
        complete, approved submission.
      </p>
      <div className="service-metrics">
        <div>
          <strong>{desk ? open.length : "—"}</strong>
          <span>Open requests</span>
        </div>
        <div>
          <strong>{desk ? soon.length : "—"}</strong>
          <span>Due within 12 hours</span>
        </div>
        <div>
          <strong>{desk ? overdue.length : "—"}</strong>
          <span>Overdue</span>
        </div>
      </div>
      <div className="service-controls">
        <label>
          Show
          <select
            aria-label="Show requests"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Open requests</option>
            <option value="overdue">Overdue</option>
            <option value="delivered">Feedback delivered</option>
            <option value="all">All requests</option>
          </select>
        </label>
        <label>
          Find a request
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Drill or request reference"
          />
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              setDesk(await api.desk());
              setNow(Date.now());
              onChange();
            })
          }
        >
          Refresh service desk
        </button>
      </div>
      <p className="member-fineprint">
        Private adult pilot · No payments collected. These are service requests,
        not paid orders. Requests and status changes are saved to the shared
        account system. No automatic email or push alerts are sent; check this
        queue daily.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!desk && !error && <p role="status">Loading service requests…</p>}
      {desk && !rows.length && (
        <div className="panel">
          <h2>No requests in this view.</h2>
          <p>
            Customer requests and video submissions appear here automatically.
            No customer data needs to be entered twice.
          </p>
        </div>
      )}
      <div className="service-requests">
        {rows.map((row) => (
          <article className="panel" key={row.id}>
            <div className="service-row-heading">
              <Tag>{SERVICE_LABELS[row.state]}</Tag>
              <span
                className={
                  reviewTiming(row, now).startsWith("Overdue")
                    ? "service-overdue"
                    : ""
                }
              >
                {reviewTiming(row, now)}
              </span>
            </div>
            <h2>{row.drill_title}</h2>
            <p>
              Request {row.id.slice(0, 8)} · Account{" "}
              {row.account_id.slice(0, 8)}
            </p>
            <dl>
              <div>
                <dt>Coach</dt>
                <dd>
                  {desk?.staff.find((s) => s.id === row.assigned_to)?.label ||
                    "Needs assignment"}
                </dd>
              </div>
              <div>
                <dt>Review target</dt>
                <dd>
                  {row.due_at
                    ? reviewDate(row.due_at)
                    : "Waiting for video & approval"}
                </dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{BLOCKERS[row.blocker]}</dd>
              </div>
            </dl>
            {row.delivered_at && (
              <p>Feedback delivered {reviewDate(row.delivered_at)}</p>
            )}
            {!["delivered", "cancelled"].includes(row.state) && (
              <button
                className="button secondary"
                onClick={() => {
                  setCurrent(row);
                  setCoach(row.assigned_to || "");
                  setBlocker(row.blocker);
                  setError("");
                }}
              >
                Manage request {row.id.slice(0, 8)}
              </button>
            )}
          </article>
        ))}
      </div>
      <p className="member-fineprint">
        This tracker shows service metadata. Private videos appear only in the
        assigned coach’s review queue. “Feedback ready” requires saved coaching
        feedback; watching a video or changing an assignment never completes the
        service.
      </p>
      {current && (
        <Modal
          title={`Manage request ${current.id.slice(0, 8)}`}
          onClose={() => {
            if (!busy) setCurrent(null);
          }}
        >
          <p>
            {current.drill_title} · {SERVICE_LABELS[current.state]}
          </p>
          <label className="service-edit-field">
            Assigned review coach
            <select
              disabled={busy}
              value={coach}
              onChange={(e) => setCoach(e.target.value)}
            >
              <option value="">Not assigned</option>
              {desk?.staff.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.label} ({s.role})
                </option>
              ))}
            </select>
          </label>
          <p>
            Assignment grants this coach access to this submitted video after
            required approval, while review access remains enabled. It does not
            open the athlete’s profile.
          </p>
          <label className="service-edit-field">
            Follow-up needed
            <select
              disabled={busy}
              value={blocker}
              onChange={(e) =>
                setBlocker(e.target.value as ReviewService["blocker"])
              }
            >
              {Object.entries(BLOCKERS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {current.state === "requested" && (
            <p>
              An Owner must enable pilot video review and assign training in
              Account access. This request does not create a purchase or change
              a subscription.
            </p>
          )}
          {owner && (
            <a
              href="#access"
              className="text-button"
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    "pd-service-access-target",
                    JSON.stringify({ actor, account: current.account_id }),
                  );
                } catch {
                  /* Use the account reference if device storage is unavailable. */
                }
              }}
            >
              Open Account access
            </a>
          )}
          <p>
            The 48-hour target starts after the full video and required approval
            arrive. Reassignment or follow-up does not reset or pause it.
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api.manage(current, coach, blocker);
                setCurrent(null);
                setDesk(await api.desk());
                onChange();
                setMessage("Assignment and follow-up saved.");
              })
            }
          >
            {busy ? "Saving…" : "Save request"}
          </button>
        </Modal>
      )}
    </section>
  );
}
