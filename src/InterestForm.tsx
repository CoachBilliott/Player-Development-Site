import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { PACKAGE_PROPOSALS } from "./packageProposals";
import { sendInterest } from "./interestIntake";
import {
  LAUNCH_NOTICE_VERSION,
  LAUNCH_NOTICE_TEXT,
  LAUNCH_NOTICE_NOTE,
  type InterestPackage,
} from "./interestContract";

export function InterestForm({ endpoint }: { endpoint: string }) {
  const [launchUpdates, setLaunchUpdates] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [choice, setChoice] = useState<InterestPackage>("undecided"),
    [adult, setAdult] = useState(false),
    [website, setWebsite] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [received, setReceived] = useState(false);
  const lock = useRef(false),
    request = useRef<{ signature: string; id: string } | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  if (received)
    return (
      <div className="interest-received">
        <p role="status" tabIndex={-1} ref={statusRef}>
          <strong>Interest received.</strong> Your request is saved for staff
          review. This has not created an account, enrollment or payment. No
          applicant confirmation email is sent.
        </p>
      </div>
    );
  return (
    <form
      className="interest-form"
      aria-label="Send adult package interest"
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current) return;
        if (!adult) {
          setError("Please confirm you are 18 or older.");
          return;
        }
        lock.current = true;
        setBusy(true);
        setError("");
        const signature = JSON.stringify([
          name.trim(),
          email.trim().toLowerCase(),
          choice,
          adult,
          website,
          launchUpdates,
          LAUNCH_NOTICE_VERSION,
        ]);
        const requestId =
          request.current?.signature === signature
            ? request.current.id
            : crypto.randomUUID();
        request.current = { signature, id: requestId };
        try {
          await sendInterest(endpoint, {
            id: requestId,
            name,
            email,
            packageInterest: choice,
            adult,
            website,
            launchUpdates,
            launchNoticeVersion: LAUNCH_NOTICE_VERSION,
          });
          setName("");
          setEmail("");
          setWebsite("");
          setReceived(true);
          requestAnimationFrame(() => statusRef.current?.focus());
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "We could not confirm receipt. Please retry or email us directly.",
          );
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label htmlFor="adult-interest-name">
          Adult name (optional)
          <input
            id="adult-interest-name"
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label htmlFor="adult-interest-email">
          Adult email
          <input
            id="adult-interest-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label htmlFor="adult-interest-package">
          Package interest
          <select
            id="adult-interest-package"
            value={choice}
            onChange={(e) => setChoice(e.target.value as InterestPackage)}
          >
            <option value="undecided">Not sure yet</option>
            {PACKAGE_PROPOSALS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div hidden aria-hidden="true">
          <label htmlFor="interest-website">
            Website
            <input
              id="interest-website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        <label className="interest-adult-check">
          <input
            type="checkbox"
            required
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
          />
          I’m 18 or older.
        </label>
        <div>
          <label className="interest-adult-check">
            <input
              type="checkbox"
              checked={launchUpdates}
              onChange={(e) => setLaunchUpdates(e.target.checked)}
            />
            {LAUNCH_NOTICE_TEXT}
          </label>
          <small className="interest-launch-note">{LAUNCH_NOTICE_NOTE}</small>
        </div>
        <p className="interest-privacy">
          Stored privately for Owner/Manager follow-up. Staff alerts:
          Repformed@gmail.com. Launch-email preference is separate.{" "}
          <a href={`${import.meta.env.BASE_URL}interest-privacy.html`}>
            Interest privacy
          </a>
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="button"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          <Send size={18} />
          {busy ? "Sending…" : "Send interest"}
        </button>
      </fieldset>
    </form>
  );
}
