import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  LogIn,
  Mail,
  Search,
  Smartphone,
} from "lucide-react";
import { Tag } from "./components";
import {
  CONTACT_ANSWERS,
  CONTACT_EMAIL,
  CONTACT_TOPICS,
  contactEmailLink,
} from "./contactContent";
import "./contact.css";

export function Contact() {
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const answers = CONTACT_ANSWERS.filter((item) =>
    terms.every((term) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(term),
    ),
  );
  return (
    <main className="page contact-page">
      <div className="contact-intro">
        <Tag>CONTACT PLAYER DEVELOPMENT</Tag>
        <h1 tabIndex={-1}>
          Let’s talk
          <br />
          <span>training.</span>
        </h1>
        <p>
          Questions about training, your account or the app? Find a quick answer
          or get in touch with the team.
        </p>
      </div>

      <div className="contact-grid">
        <section
          className="contact-email-card"
          aria-labelledby="contact-team-title"
        >
          <Mail size={30} aria-hidden="true" />
          <p className="eyebrow">A DIRECT LINE TO THE TEAM</p>
          <h2 id="contact-team-title">How can we help?</h2>
          <p className="contact-address">{CONTACT_EMAIL}</p>
          <label htmlFor="contact-topic">What is your question about?</label>
          <select
            id="contact-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            {CONTACT_TOPICS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <a className="button" href={contactEmailLink(topic)}>
            Open email app <ArrowUpRight size={19} aria-hidden="true" />
          </a>
          <p className="contact-note">
            This opens your email app with a subject line. Write and send your
            message there. If no email app opens, copy the address above into
            your inbox.
          </p>
          <p className="contact-note">
            For account questions, write from your account email address. Please
            leave passwords, payment details and private player videos out of
            general support messages.
          </p>
        </section>

        <section
          className="contact-resources"
          aria-labelledby="contact-resources-title"
        >
          <p className="eyebrow">KEEP MOVING</p>
          <h2 id="contact-resources-title">Find your next step.</h2>
          <a className="contact-resource" href="#account">
            <LogIn size={25} aria-hidden="true" />
            <span>
              <strong>Account & login</strong>
              <span>Sign in, reset your password or finish an invitation.</span>
            </span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </a>
          <a
            className="contact-resource"
            href={`${import.meta.env.BASE_URL}partner-guide.html`}
          >
            <BookOpen size={25} aria-hidden="true" />
            <span>
              <strong>Website & app guide</strong>
              <span>
                A walkthrough of training, uploads and private reviews.
              </span>
            </span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </a>
          <a className="contact-resource" href="#app-help">
            <Smartphone size={25} aria-hidden="true" />
            <span>
              <strong>App help</strong>
              <span>Help with access, workouts and using the iPhone app.</span>
            </span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </a>
          <p className="contact-resource-note">
            Football is our first program. The same training platform supports
            parent-managed families and individual adult athletes.
          </p>
        </section>
      </div>

      <section className="contact-faq" aria-labelledby="contact-faq-title">
        <p className="eyebrow">QUICK ANSWERS</p>
        <h2 id="contact-faq-title">Before you reach out.</h2>
        <label className="contact-search" htmlFor="contact-search">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">Search help questions</span>
          <input
            id="contact-search"
            type="search"
            placeholder="Search accounts, workouts, reviews…"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="contact-answer-count" role="status">
          {answers.length} {answers.length === 1 ? "answer" : "answers"}
          {query.trim() ? " found" : " to common questions"}
        </p>
        <div className="contact-answers">
          {answers.map((item) => (
            <details key={item.id}>
              <summary>{item.question}</summary>
              <div>
                <p>{item.answer}</p>
                {item.href && (
                  <a className="text-button" href={item.href}>
                    {item.link} <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>
        {answers.length === 0 && (
          <div className="contact-no-answer">
            <p>
              No matching answer yet. Try a different word or email the team.
            </p>
            <button className="button secondary" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}
        <p className="contact-faq-footer">
          Still have a question?{" "}
          <a href={contactEmailLink(CONTACT_TOPICS[0])}>Email our team.</a>
        </p>
      </section>
    </main>
  );
}
