import { ArrowDown, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { AthleteScene } from "./AthleteScene";
import { Reveal } from "./Experience";
import { Tag } from "./components";
import { SPORTS } from "./model";
import { PACKAGE_PROPOSALS } from "./packageProposals";
import { useMotion } from "./motion";

const media = `${import.meta.env.BASE_URL}media/`;

export function Home() {
  const { enabled } = useMotion();
  return (
    <main className="home home-package-journey">
      <section className="hero">
        <AthleteScene />
        <div className="hero-copy">
          <div className="sport-tag">
            <span /> FOOTBALL · IN DEVELOPMENT
          </div>
          <h1 tabIndex={-1}>
            Know the game.
            <br />
            <span className="electric-text">Own your rep.</span>
          </h1>
          <p className="hero-description">
            Football IQ. Purposeful practice. A clearer next step. We’re
            building a learning and training path for families and adult
            athletes.
          </p>
          <p className="home-availability">
            In development with a private adult pilot. Youth enrollment and paid
            packages are not open.
          </p>
          <div className="actions">
            <a className="button" href="#membership">
              See proposed packages <ArrowUpRight size={20} />
            </a>
            <a className="text-button" href="#demo">
              Try the demo <ArrowRight size={18} />
            </a>
          </div>
          <div className="hero-demo-note">
            <span>Free fictional demo. No account needed.</span>
            <button
              className="text-button"
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({
                  behavior: enabled ? "smooth" : "auto",
                })
              }
            >
              See how it works <ArrowDown size={17} />
            </button>
          </div>
        </div>
        <div className="hero-edition" aria-hidden="true">
          <span>REPFORMED</span>
          <span>THE WORK STARTS HERE / 01</span>
        </div>
      </section>

      <div className="training-principles" aria-label="The training approach">
        {[
          "Understand the game.",
          "Practise with purpose.",
          "Keep the next step clear.",
        ].map((text, i) => (
          <div key={text}>
            <span>0{i + 1}</span>
            <p>{text}</p>
            <ArrowUpRight size={24} aria-hidden="true" />
          </div>
        ))}
      </div>

      <Reveal>
        <section
          className="page home-package-path"
          aria-labelledby="package-path-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                FOUR PROPOSED PACKAGES · ONE PLATFORM
              </span>
              <h2 id="package-path-title">
                Learn first.
                <br />
                Build from there.
              </h2>
            </div>
            <p>
              Start with understanding the game. Add guided practice, position
              focus or closer coaching support as the athlete’s needs change.
            </p>
          </div>
          <ol className="home-package-ladder">
            {PACKAGE_PROPOSALS.map((p, i) => (
              <li key={p.id}>
                <span className="package-step-number" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{p.name}</h3>
                <p>{p.focus}</p>
                <strong>{p.cadence}</strong>
                {p.id === "position-development" && (
                  <small>
                    Position work replaces or adapts the two drills.
                  </small>
                )}
                {p.id === "elite-coaching" && (
                  <small>
                    Written feedback · up to three minutes of footage per
                    review.
                  </small>
                )}
              </li>
            ))}
          </ol>
          <div className="home-package-path-footer">
            <span>Features and prices are proposals under review.</span>
            <a className="text-button" href="#membership">
              Compare packages & proposed prices <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal className="athlete-paths-section">
        <section
          className="page athlete-paths"
          aria-labelledby="platform-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE PLANNED EXPERIENCE</span>
              <h2 id="platform-title">
                Know what
                <br />
                they’re learning.
              </h2>
            </div>
            <p>
              See what the athlete is learning, what to practise and where to
              help. Parent-managed and individual adult accounts use the same
              platform.
            </p>
          </div>
          <div className="path-grid">
            <article className="path-card path-family">
              <img
                src={`${media}family-football.jpg`}
                alt=""
                loading="lazy"
                width={1440}
                height={960}
              />
              <div className="path-shade" aria-hidden="true" />
              <span className="path-tag">SUPPORT AROUND THE ATHLETE</span>
              <div className="path-copy">
                <h3>
                  Keep the week
                  <br />
                  in view.
                </h3>
                <p>
                  The planned parent dashboard brings lessons, practice history
                  and athlete permissions together, so parents can support the
                  routine.
                </p>
                <span className="path-detail">
                  <ShieldCheck size={16} /> Planned parent management · youth
                  enrollment closed
                </span>
              </div>
            </article>
            <article className="path-card path-solo">
              <img
                src={`${media}solo-football.jpg`}
                alt=""
                loading="lazy"
                width={1440}
                height={2160}
              />
              <div className="path-shade" aria-hidden="true" />
              <span className="path-tag">TRAINING THAT FITS THE PLAYER</span>
              <div className="path-copy">
                <h3>
                  Give the work
                  <br />a purpose.
                </h3>
                <p>
                  Fundamental and position packages propose clear practice steps
                  and coaching cues. Elite adds written feedback on selected
                  drills.
                </p>
                <span className="path-detail">
                  Proposed progression by age, position and experience.
                </span>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal className="practice-section">
        <section id="how-it-works" className="page how-section">
          <div className="practice-intro">
            <span className="eyebrow">THE PROPOSED WEEKLY RHYTHM</span>
            <h2>A week with a clear next step.</h2>
            <p>
              Learning leads into practice. Drill packages propose Sunday
              loading, so the week starts with a plan. The schedule is still
              being validated.
            </p>
            <a className="text-button" href="#demo">
              Step inside the demo <ArrowUpRight size={19} />
            </a>
          </div>
          <div className="practice-steps">
            {[
              {
                n: "01",
                title: "Learn the why",
                text: "Foundation proposes two football-IQ videos and short quizzes each week. No drills.",
              },
              {
                n: "02",
                title: "Put it into practice",
                text: "Fundamentals adds two drill videos a week. Position Development adapts those assignments to one primary position.",
              },
              {
                n: "03",
                title: "Bring the work back",
                text: "Keep a record of participation. Elite proposes two selected video reviews per month, with written next-practice feedback.",
              },
            ].map((step) => (
              <article className="practice-step" key={step.n}>
                <span>{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="sport-programs-section">
        <section className="page sport-programs" aria-labelledby="sports-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE STARTING LINE</span>
              <h2 id="sports-title">
                Football first.
                <br />
                Development always.
              </h2>
            </div>
            <p>
              Football is our focus today. More sports are on the horizon. We’ll
              announce what’s next when it’s ready.
            </p>
          </div>
          <div className="sport-program-grid">
            {SPORTS.filter((sport) => sport.available).map((sport, i) => (
              <article
                key={sport.id}
                className="sport-program available"
                aria-label={`${sport.name} program`}
              >
                <img
                  className="football-program-image"
                  src={`${media}football-field.jpg`}
                  alt=""
                  loading="lazy"
                  width={1280}
                  height={720}
                />
                <div className="sport-program-top">
                  <span className="sport-program-index">0{i + 1}</span>
                  <Tag>DEMO AVAILABLE</Tag>
                </div>
                <div className="sport-program-content">
                  <h3>{sport.name}</h3>
                  <p>
                    Preview a fictional, noncontact guided session. Full package
                    content is still in development.
                  </p>
                  <a className="button" href="#demo">
                    Try the football demo <ArrowUpRight size={19} />
                  </a>
                </div>
              </article>
            ))}
            <article
              className="sport-program future"
              aria-label="Future sports"
            >
              <div className="sport-program-top">
                <span className="sport-program-index">THE NEXT CHAPTER</span>
                <Tag>COMING LATER</Tag>
              </div>
              <div className="sport-program-content">
                <h3>More sports ahead.</h3>
                <p>
                  The work doesn’t stop with one sport. We’re building toward
                  more ways to train, with future sports to be announced.
                </p>
                <span className="sport-future-note">
                  Future offerings · Details to be announced
                </span>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="home-finish" aria-labelledby="finish-title">
          <div className="page finish-inner">
            <div>
              <span className="eyebrow">HELP SHAPE WHAT’S NEXT.</span>
              <h2 id="finish-title">
                Find your
                <br />
                starting point.
              </h2>
            </div>
            <div className="finish-actions">
              <p>
                Tell us which proposal fits. Choose a package and email your
                interest from your mail app. Enrollment remains closed.
              </p>
              <a className="button" href="?interest=1#membership">
                Express interest <ArrowUpRight size={20} />
              </a>
              <a className="text-button" href="#membership">
                See proposed packages <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <div className="page home-disclaimer">
          Public signup and junior enrollment are not open yet. Explore the demo
          with fictional profiles.
        </div>
      </Reveal>
    </main>
  );
}
