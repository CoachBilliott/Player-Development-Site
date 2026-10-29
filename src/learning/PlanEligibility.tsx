import { useState } from "react";
import type { LearningTransport } from "./api";
import { PACKAGE_PROPOSALS } from "../packageProposals";
import { chicagoInstant } from "./schedule";
export function PlanEligibility({
  api,
  profile,
  onSaved,
}: {
  api: LearningTransport;
  profile: string;
  onSaved: () => void;
}) {
  const [packageId, setPackage] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function save(revoke: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const from = chicagoInstant(start.slice(0, 10), start.slice(11, 16)),
        until = chicagoInstant(end.slice(0, 10), end.slice(11, 16));
      if (until <= from) throw Error("Access must stop after it starts.");
      await api.setAccess(
        profile,
        packageId,
        from.toISOString(),
        until.toISOString(),
        reason.trim(),
        revoke,
      );
      setStatus(
        revoke
          ? "Plan eligibility revoked. Recorded progress and grades remain."
          : "Plan eligibility recorded. This is a manual verification, not proof of payment.",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eligibility was not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="learning-eligibility">
      <summary>Owner: verify package eligibility</summary>
      <p>
        Use a verified business decision or an explicitly approved private test.
        This does not collect a payment or change account roles. Revocation
        stops new protected content access; already signed media links can
        remain valid until expiry.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Package
            <select
              required
              value={packageId}
              onChange={(e) => setPackage(e.target.value)}
            >
              <option value="">Choose package</option>
              {PACKAGE_PROPOSALS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="private_test">Private test · no purchase</option>
            </select>
          </label>
          <label>
            Access starts · Central time
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Access stops · Central time
            <input
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label>
            Verification reason
            <textarea
              required
              minLength={1}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={!reason.trim()}>Record verified eligibility</button>
          <button
            type="button"
            disabled={!packageId || !start || !end || !reason.trim()}
            onClick={() => void save(true)}
          >
            Revoke eligibility
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
