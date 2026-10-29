import { ArrowRight } from "lucide-react";
import { Tag } from "./components";
import { CONTACT_EMAIL } from "./contactContent";
import "./customerHelp.css";

export function CustomerHelp() {
  return (
    <main className="page customer-help">
      <div className="page-intro">
        <Tag>CUSTOMER HELP</Tag>
        <h1 tabIndex={-1}>Find your next step.</h1>
        <p>
          Explore Repformed, use an invitation or get help with your account.
        </p>
      </div>
      <nav className="help-topics" aria-label="Help topics">
        {[
          ["help-explore", "Explore & express interest"],
          ["help-access", "Invitations & sign-in"],
          ["help-training", "Training & reviews"],
          ["help-information", "Your information"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => {
              const heading = document.getElementById(id);
              heading?.focus({ preventScroll: true });
              heading?.scrollIntoView({ block: "start" });
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <section aria-labelledby="help-explore">
        <h2 id="help-explore" tabIndex={-1}>
          Exploring Repformed
        </h2>
        <p>
          We’re preparing a football learning and training platform for families
          and adult athletes. Public enrollment and paid memberships are not
          open. Existing invited accounts use their approved access.
        </p>
        <p>
          The four proposed packages describe plans under review. Prices are in
          USD per athlete. One guardian account can manage multiple athletes;
          each subscribed Elite athlete would have their own two monthly
          reviews. No payments or reservations are taken, and no launch date is
          promised.
        </p>
        <div className="help-actions">
          <a className="button secondary" href="#membership">
            Compare proposed packages <ArrowRight size={17} />
          </a>
          <a className="button" href="?interest=1#membership">
            Express interest <ArrowRight size={17} />
          </a>
        </div>
        <h3>Leave your interest</h3>
        <p>
          Use the package page to leave your adult email and package interest.
          Your adult name is optional. Please leave out children’s names, birth
          dates, health information and videos.
        </p>
        <p>
          Expressing interest does not enroll an athlete or reserve a place.
          “Email me when Repformed launches” is optional and starts unchecked.
          Contact the team to change or withdraw an earlier request.
        </p>
        <p>
          <a href={`${import.meta.env.BASE_URL}interest-privacy.html`}>
            Read interest privacy
          </a>
          . If you prefer email, open “Need another way? Email us directly” on
          the package page, then write and send your message in your email app.
        </p>
        <h3>The fictional preview</h3>
        <p>
          The optional preview illustrates sample family screens and guided
          practice with fictional profiles. Practice reports stay in that
          browser. It is not a preview of every proposed package feature; sample
          activities are noncontact and await qualified review.
        </p>
        <a className="text-button" href="#demo">
          Open fictional practice preview <ArrowRight size={17} />
        </a>
      </section>
      <section aria-labelledby="help-access">
        <h2 id="help-access" tabIndex={-1}>
          Invitations and sign-in
        </h2>
        <p>
          Account access is by invitation. Existing customers and staff use the
          same account-access page. Follow your invitation email to verify your
          address, choose your password and finish the setup assigned to you.
        </p>
        <p>
          If an invitation has expired or been canceled, ask the team to check
          your access. For a forgotten password, use website recovery. On
          iPhone, complete the email steps in Safari before returning to the
          app.
        </p>
        <div className="help-actions">
          <a className="button secondary" href="#account">
            Open account access <ArrowRight size={17} />
          </a>
          <a href={`${import.meta.env.BASE_URL}account-help.html`}>
            Account setup and deletion help
          </a>
        </div>
      </section>
      <section aria-labelledby="help-training">
        <h2 id="help-training" tabIndex={-1}>
          Finding your training
        </h2>
        <p>
          For invited customers, Today shows the next assigned session, Workouts
          holds available training, Progress shows reported practice, and
          Account holds account settings. A parent selects the correct family
          athlete first. Access depends on approved permissions and assignments.
        </p>
        <p>
          An empty account does not mean a payment is needed. Contact the team
          if you expected training or cannot find the right workspace. Practice
          records describe participation, not proven athletic improvement. Real
          junior enrollment remains closed.
        </p>
        <h3>Private video reviews</h3>
        <p>
          Video review is a separate optional permission enabled by an Owner for
          approved accounts. It does not start a subscription. Use the private
          review screen for its current limits and status; proposed package
          allowances do not change current account access. Real junior video
          uploads remain closed.
        </p>
        <p>
          Do not send private player footage, passwords or payment details
          through general support email.
        </p>
      </section>
      <section aria-labelledby="help-install">
        <h2 id="help-install" tabIndex={-1}>
          Adding the web app
        </h2>
        <p>
          You can add the web app to a supported device’s home screen.
          Installation does not create an account or start a subscription.
          Sign-in, private profiles, new training, uploads and updates need an
          internet connection.
        </p>
        <p>
          Native iPhone testing access is separate. If you have approved
          TestFlight access, use the instructions supplied for that test.
        </p>
        <a className="text-button" href="#install">
          Installation instructions <ArrowRight size={17} />
        </a>
      </section>
      <section aria-labelledby="help-information">
        <h2 id="help-information" tabIndex={-1}>
          Your information and account
        </h2>
        <p>
          The interest privacy notice explains information submitted through the
          interest form. Invited customers can find account setup and deletion
          instructions in account help. Staff and guardian-managed closure use a
          review process.
        </p>
        <div className="help-actions">
          <a href={`${import.meta.env.BASE_URL}interest-privacy.html`}>
            Interest privacy
          </a>
          <a href={`${import.meta.env.BASE_URL}account-help.html`}>
            Account setup and deletion
          </a>
        </div>
      </section>
      <section aria-labelledby="help-person">
        <h2 id="help-person">Need a person?</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For
          account questions, write from your account email. Leave out passwords,
          payment details and private player footage.
        </p>
        <p>
          Opening an email link does not send a message. If no email app opens,
          copy the address into your usual inbox.
        </p>
        <a className="text-button" href="#contact">
          Contact the team <ArrowRight size={17} />
        </a>
      </section>
      <details className="help-staff-reference">
        <summary>Staff reference and historical guides</summary>
        <p>
          The build-10 walkthrough contains earlier interface names and
          screenshots. It is a historical staff reference, not the current
          customer guide or evidence of a current native release.
        </p>
        <a href={`${import.meta.env.BASE_URL}partner-guide.html`}>
          Historical staff pilot walkthrough
        </a>
      </details>
    </main>
  );
}
