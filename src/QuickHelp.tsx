import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleHelp,
  Mail,
  Search,
} from "lucide-react";
import { Modal } from "./components";
import {
  CONTACT_ANSWERS,
  CONTACT_TOPICS,
  contactEmailLink,
} from "./contactContent";
import { nativeApp, openWebsite } from "./mobile";
import "./quick-help.css";

export function QuickHelp() {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={launcher}
        className="text-button quick-help-launcher"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={19} aria-hidden="true" /> Quick help
      </button>
      {open && (
        <HelpDialog
          onClose={() => setOpen(false)}
          onDismiss={() => {
            setOpen(false);
            requestAnimationFrame(() => launcher.current?.focus());
          }}
        />
      )}
    </>
  );
}

function HelpDialog({
  onClose,
  onDismiss,
}: {
  onClose: () => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = CONTACT_ANSWERS.filter((answer) =>
    terms.every((term) =>
      `${answer.question} ${answer.answer}`.toLowerCase().includes(term),
    ),
  );
  const answer = CONTACT_ANSWERS.find((item) => item.id === selected);
  return (
    <Modal title="How can we help?" onClose={onDismiss}>
      <div className="quick-help">
        <p className="quick-help-note">
          Quick answers from our product guide. This is FAQ help, not live chat
          or AI. Searches stay on this device.
        </p>
        {answer ? (
          <section aria-labelledby="quick-answer-title">
            <button className="text-button" onClick={() => setSelected(null)}>
              <ArrowLeft size={18} aria-hidden="true" /> All questions
            </button>
            <h3
              id="quick-answer-title"
              tabIndex={-1}
              ref={(node) => node?.focus()}
            >
              {answer.question}
            </h3>
            <p>{answer.answer}</p>
            {answer.href && (
              <a
                className="text-button"
                href={answer.href}
                onClick={(event) => {
                  if (!nativeApp()) {
                    onClose();
                    return;
                  }
                  event.preventDefault();
                  void openWebsite(answer.href)
                    .then(onClose)
                    .catch(() =>
                      setError(
                        "The website could not open. Open Repformed in Safari for this step.",
                      ),
                    );
                }}
              >
                {answer.link} <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            )}
          </section>
        ) : (
          <>
            <label className="quick-help-search">
              <span>Search help topics</span>
              <span>
                <Search size={19} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  maxLength={120}
                  placeholder="Try password, upload or membership"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </label>
            <p className="quick-help-count" role="status">
              {matches.length} {matches.length === 1 ? "answer" : "answers"}{" "}
              available
            </p>
            <div className="quick-help-questions">
              {matches.map((item) => (
                <button key={item.id} onClick={() => setSelected(item.id)}>
                  {item.question}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
            {!matches.length && (
              <div className="quick-help-empty">
                <p>
                  We do not have an approved answer for that yet. Email the team
                  for help with your question or account.
                </p>
                <button className="text-button" onClick={() => setQuery("")}>
                  Show all questions
                </button>
              </div>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="quick-help-handoff">
          <strong>Need a person?</strong>
          <a className="text-button" href={contactEmailLink(CONTACT_TOPICS[0])}>
            <Mail size={18} aria-hidden="true" /> Email the team
          </a>
          <p>
            Opens your email app. No message is sent here. Leave out passwords,
            payment details and private player footage.
          </p>
        </div>
      </div>
    </Modal>
  );
}
