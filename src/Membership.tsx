import { useEffect, useState } from "react";
import { ArrowRight, Copy, Mail } from "lucide-react";
import { Tag, CheckLine } from "./components";
import { CONTACT_EMAIL } from "./contactContent";
import { PACKAGE_PROPOSALS, packageInterestLink } from "./packageProposals";
import "./memberships.css";

function focusInterest() {
  document.getElementById("interest-title")?.focus({ preventScroll: true });
  document
    .getElementById("package-interest")
    ?.scrollIntoView({ block: "start" });
}

export function Membership() {
  const [interest, setInterest] = useState("undecided"),
    [copy, setCopy] = useState("");
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
        <Tag>PROPOSALS · FEEDBACK WELCOME</Tag>
        <h1 tabIndex={-1}>A path for the next step.</h1>
        <p>
          Four proposed ways to learn and train with Repformed. Help us shape
          what comes next.
        </p>
      </div>
      <section
        className="membership-availability"
        aria-label="Current availability"
      >
        <strong>In development · private adult pilot</strong>
        <p>
          Youth enrollment and paid packages are not open. The features and
          prices below are future proposals being validated, not active offers.
          Annual prices and terms remain under review. No launch date is
          promised.
        </p>
        <button className="text-button" onClick={focusInterest}>
          Share your interest <ArrowRight size={17} />
        </button>
      </section>
      <div className="proposed-package-grid">
        {PACKAGE_PROPOSALS.map((p, i) => (
          <article
            className="package-card proposed-package"
            aria-labelledby={`package-${p.id}`}
            key={p.id}
          >
            <div className="proposal-top">
              <Tag>PROPOSED PACKAGE</Tag>
              <span>0{i + 1}</span>
            </div>
            <h2 id={`package-${p.id}`}>{p.name}</h2>
            <p className="proposal-focus">{p.focus}</p>
            <div className="proposal-price">
              <strong>${p.monthly}</strong>
              <span>/ month proposed</span>
              <small>
                ${p.annual} / year proposed · annual terms under review
              </small>
            </div>
            <p className="proposal-cadence">{p.cadence}</p>
            <p className="proposal-includes">{p.includes}</p>
            <div className="check-lines">
              {p.items.map((text) => (
                <CheckLine key={text}>{text}</CheckLine>
              ))}
            </div>
            {"note" in p && <p className="proposal-note">{p.note}</p>}
            <span className="proposal-closed">Not available to purchase</span>
          </article>
        ))}
      </div>
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
          Current private-pilot access follows its separate instructions and
          limits. These proposed packages do not change current uploads,
          services or billing.
        </p>
      </section>
      <section
        id="package-interest"
        className="package-interest"
        aria-labelledby="interest-title"
      >
        <div>
          <Tag>FOR PARENTS, GUARDIANS & ADULTS</Tag>
          <h2 id="interest-title" tabIndex={-1}>
            Interested? Tell us what fits.
          </h2>
          <p>
            Choose a proposal or send your feedback. This opens your email app;
            write and send your message there.
          </p>
          <p>
            Interest only—not enrollment, payment or a reservation. No launch
            date is promised. Please leave out child names, birth dates, videos
            and health details.
          </p>
        </div>
        <div className="interest-actions">
          <label htmlFor="interest-package">
            Package you’re interested in
            <select
              id="interest-package"
              value={interest}
              onChange={(e) => {
                setInterest(e.target.value);
                setCopy("");
              }}
            >
              <option value="undecided">Not sure yet / general feedback</option>
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
                setCopy("Email address copied. Paste it into your email app.");
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
            No email app opening? Copy the address and email us directly. The
            website does not submit, store or add you to a mailing list.
          </p>
        </div>
      </section>
      <div className="centered">
        <a className="button secondary" href="#demo">
          Try the fictional sample demo <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
