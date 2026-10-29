import { useEffect, useState } from "react";
import { ArrowRight, Copy, Mail } from "lucide-react";
import { Tag, CheckLine } from "./components";
import { CONTACT_EMAIL } from "./contactContent";
import { PACKAGE_PROPOSALS, packageInterestLink } from "./packageProposals";
import "./memberships.css";
import { InterestForm } from "./InterestForm";
import type { InterestPackage } from "./interestContract";

function focusInterest() {
  document.getElementById("interest-title")?.focus({ preventScroll: true });
  document
    .getElementById("package-interest")
    ?.scrollIntoView({ block: "start" });
}

export function Membership({
  interestEndpoint = null,
  interestLoading = false,
}: {
  interestEndpoint?: string | null;
  interestLoading?: boolean;
}) {
  const pending = interestLoading && !interestEndpoint;
  const [interest, setInterest] = useState<InterestPackage>("undecided"),
    [copy, setCopy] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [submissionState, setSubmissionState] = useState<
    "idle" | "sending" | "received"
  >("idle");
  function changePackage(id: InterestPackage) {
    setInterest(id);
    setSelectionNotice("");
    setCopy("");
  }
  function selectPackage(id: InterestPackage, name: string) {
    if (submissionState !== "idle") return;
    setInterest(id);
    setCopy("");
    setSelectionNotice(`${name} selected. Review your details before sending.`);
    focusInterest();
  }
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("interest") !== "1") return;
    let second: number | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        focusInterest();
        url.searchParams.delete("interest");
        history.replaceState(history.state, "", url);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== undefined) cancelAnimationFrame(second);
    };
  }, []);
  return (
    <main className="page memberships proposed-memberships">
      <div className="page-intro centered">
        <Tag>PRELAUNCH PACKAGE PLANS</Tag>
        <h1 tabIndex={-1}>A path for the next step.</h1>
        <p>
          Four ways to build football understanding and purposeful practice.
          Find your starting point.
        </p>
      </div>
      <section
        className="membership-availability"
        aria-label="Current availability"
      >
        <strong>Interest is open. Enrollment is not.</strong>
        <p>
          These are proposed plans. Enrollment, payments and reservations are
          not open. Features, prices and annual terms remain under review.
        </p>
        <p>
          USD per athlete. One guardian account can manage multiple athletes.
          Each subscribed Elite athlete would have two monthly reviews, not
          shared across siblings.
        </p>
        <button className="text-button" onClick={focusInterest}>
          Share your interest <ArrowRight size={17} />
        </button>
      </section>
      <section
        className="proposed-package-grid"
        aria-label="Compare proposed packages"
      >
        {PACKAGE_PROPOSALS.map((p) => (
          <article
            className="package-card proposed-package"
            aria-labelledby={`package-${p.id}`}
            key={p.id}
          >
            <div className="proposal-identity">
              <h2 id={`package-${p.id}`}>{p.name}</h2>
              <div className="proposal-price">
                <strong>${p.monthly}</strong>
                <span>USD / athlete / month</span>
                <small>${p.annual} / year proposed · USD per athlete</small>
              </div>
            </div>
            <div className="proposal-summary">
              <p className="proposal-cadence">{p.cadence}</p>
              <details className="proposal-details">
                <summary>What’s included in {p.name}</summary>
                <p className="proposal-focus">{p.focus}</p>
                <p className="proposal-includes">{p.includes}</p>
                <div className="check-lines">
                  {p.items.map((text) => (
                    <CheckLine key={text}>{text}</CheckLine>
                  ))}
                </div>
                {"note" in p && <p className="proposal-note">{p.note}</p>}
              </details>
            </div>
            <div className="proposal-action">
              <button
                className="button secondary"
                disabled={submissionState !== "idle"}
                onClick={() => selectPackage(p.id, p.name)}
              >
                Express interest in {p.name}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <span className="proposal-closed">Not available to purchase</span>
            </div>
          </article>
        ))}
      </section>
      <section
        className="proposal-rhythm"
        aria-label="Proposed delivery rhythm"
      >
        <h2>Planned for the week ahead.</h2>
        <p>
          Sunday drill loading is proposed for Fundamentals, Position
          Development and Elite Coaching. It is not an active public delivery
          schedule. Foundation includes football-IQ learning, not drills.
        </p>
        <p>
          Existing invited accounts follow their current access and review
          limits. <a href="#contact">Questions about current access?</a>
        </p>
      </section>
      <section
        id="package-interest"
        className="package-interest"
        aria-labelledby="interest-title"
      >
        <div>
          <Tag>
            {pending
              ? "INTEREST"
              : interestEndpoint
                ? "ADULT INTEREST"
                : "FOR PARENTS, GUARDIANS & ADULTS"}
          </Tag>
          <h2 id="interest-title" tabIndex={-1}>
            Interested? Tell us what fits.
          </h2>
          {selectionNotice && (
            <p role="status" className="interest-selection">
              {selectionNotice}
            </p>
          )}
          <p role={pending ? "status" : undefined}>
            {pending
              ? "Loading interest form…"
              : interestEndpoint
                ? "Leave your adult email and package interest. No account needed."
                : "Choose a proposal or send your feedback. This opens your email app; write and send your message there."}
          </p>
          <p>
            {pending || interestEndpoint
              ? "Interest only—not enrollment, payment or a reservation. Please leave out children’s information."
              : "Interest only—not enrollment, payment or a reservation. No launch date is promised. Please leave out child names, birth dates, videos and health details."}
          </p>
        </div>
        {!pending && interestEndpoint && (
          <InterestForm
            endpoint={interestEndpoint}
            packageChoice={interest}
            onPackageChange={changePackage}
            onStateChange={(next) => {
              setSubmissionState(next);
              if (next !== "idle") setSelectionNotice("");
            }}
          />
        )}
        {!pending && (
          <details
            className="interest-email-fallback"
            open={interestEndpoint ? undefined : true}
          >
            <summary>
              {interestEndpoint
                ? "Need another way? Email us directly"
                : "Email your interest"}
            </summary>
            <div className="interest-actions">
              <label htmlFor="interest-package">
                Package you’re interested in
                <select
                  id="interest-package"
                  value={interest}
                  disabled={submissionState !== "idle"}
                  onChange={(e) => {
                    changePackage(e.target.value as InterestPackage);
                  }}
                >
                  <option value="undecided">
                    Not sure yet / general feedback
                  </option>
                  {PACKAGE_PROPOSALS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <a className="button" href={packageInterestLink(interest)}>
                <Mail size={18} />
                Email package interest
              </a>
              <p className="interest-address">{CONTACT_EMAIL}</p>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(CONTACT_EMAIL);
                    setCopy(
                      "Email address copied. Paste it into your email app.",
                    );
                  } catch {
                    setCopy(
                      "Copy is unavailable. Select the address above and paste it into your email app.",
                    );
                  }
                }}
              >
                <Copy size={16} />
                Copy email address
              </button>
              {copy && <p role="status">{copy}</p>}
              <p className="interest-fallback">
                No email app opening? Copy the address and email us directly.
                The
                {interestEndpoint
                  ? "email fallback does not submit the form; write and send your message in your email app."
                  : "website does not submit, store or add you to a mailing list."}
              </p>
            </div>
          </details>
        )}
      </section>
      <div className="centered">
        <a className="button secondary" href="#demo">
          Optional fictional preview <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
