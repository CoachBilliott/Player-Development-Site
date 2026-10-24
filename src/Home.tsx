import { ArrowDown, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { AthleteScene } from "./AthleteScene";
import { Reveal } from "./Experience";
import { Tag } from "./components";
import { SPORTS } from "./model";
import { useMotion } from "./motion";

const media = `${import.meta.env.BASE_URL}media/`;

export function Home() {
  const { enabled } = useMotion();
  return (
    <main className="home">
      <section className="hero">
        <AthleteScene />
        <div className="hero-copy">
          <div className="sport-tag">
            <span /> ATHLETE DEVELOPMENT · AGES 5 TO ADULT
          </div>
          <h1 tabIndex={-1}>
            Your game.
            <br />
            <span className="electric-text">Your next rep.</span>
          </h1>
          <p className="hero-description">
            A clear plan for the work you put in. Guided football practice for
            individual athletes and parent-managed families.
          </p>
          <div className="actions">
            <a className="button" href="#demo">
              Try the demo <ArrowUpRight size={20} />
            </a>
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
          <p className="hero-demo-note">
            Free sample-data demo. No account needed.
          </p>
        </div>
        <div className="hero-edition" aria-hidden="true">
          <span>PLAYER DEVELOPMENT</span>
          <span>THE WORK STARTS HERE / 01</span>
        </div>
      </section>

      <div className="training-principles" aria-label="The training approach">
        {["Find your focus.", "Put in the practice.", "Own your routine."].map(
          (text, i) => (
            <div key={text}>
              <span>0{i + 1}</span>
              <p>{text}</p>
              <ArrowUpRight size={24} aria-hidden="true" />
            </div>
          ),
        )}
      </div>

      <Reveal className="athlete-paths-section">
        <section className="page athlete-paths" aria-labelledby="paths-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                DIFFERENT STARTING POINTS. SAME PURPOSE.
              </span>
              <h2 id="paths-title">
                Find your way
                <br />
                into the work.
              </h2>
            </div>
            <p>
              One athlete or a whole family. See how a plan can fit the person
              behind the player.
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
              <span className="path-tag">01 / PARENT & FAMILY</span>
              <div className="path-copy">
                <h3>
                  Their effort.
                  <br />
                  Your support.
                </h3>
                <p>
                  Explore separate athlete profiles, parent permissions and
                  workout reviews in the family demo.
                </p>
                <span className="path-detail">
                  <ShieldCheck size={16} /> Parent-managed for all athletes
                  under 18
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
              <span className="path-tag">02 / INDIVIDUAL ATHLETE</span>
              <div className="path-copy">
                <h3>
                  Your goals.
                  <br />
                  Your routine.
                </h3>
                <p>
                  Try a guided session matched to a fictional adult athlete’s
                  position, experience and training goals.
                </p>
                <span className="path-detail">
                  One athlete. Their own plan and practice history.
                </span>
              </div>
            </article>
          </div>
          <div className="path-bottom">
            <p>
              Licensed stock imagery, not members or coaching lessons. Demo
              profiles are fictional.
            </p>
            <a className="button" href="#demo">
              Find your path in the demo <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal className="practice-section">
        <section id="how-it-works" className="page how-section">
          <div className="practice-intro">
            <span className="eyebrow">LESS GUESSWORK. MORE PURPOSE.</span>
            <h2>A clear path from plan to practice.</h2>
            <p>
              Open your session. Know what to work on. Take it one drill at a
              time.
            </p>
            <a className="text-button" href="#demo">
              Step inside the demo <ArrowUpRight size={19} />
            </a>
          </div>
          <div className="practice-steps">
            {[
              {
                n: "01",
                title: "Choose your player",
                text: "Age, position, experience and goals give each sample player a starting point.",
              },
              {
                n: "02",
                title: "Follow your session",
                text: "Short lessons, clear practice steps and coaching cues guide the next drill.",
              },
              {
                n: "03",
                title: "Record your practice",
                text: "Build a history of participation. Parents can review reports; completion is not proof of improved ability.",
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
                  <Tag>AVAILABLE NOW</Tag>
                </div>
                <div className="sport-program-content">
                  <h3>{sport.name}</h3>
                  <p>
                    Explore noncontact football sample practice matched to the
                    player. Football is the first program in the demo.
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
          <p className="program-media-note">
            Licensed stock field image · No venue affiliation.{" "}
            <a href={`${media}credits.txt`} target="_blank" rel="noreferrer">
              Media credits
            </a>
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="home-finish" aria-labelledby="finish-title">
          <div className="page finish-inner">
            <div>
              <span className="eyebrow">MAKE ROOM FOR THE WORK.</span>
              <h2 id="finish-title">
                The next rep
                <br />
                starts with you.
              </h2>
            </div>
            <div className="finish-actions">
              <p>See the plan. Try the practice. Find your starting point.</p>
              <a className="button" href="#demo">
                Explore the free demo <ArrowUpRight size={20} />
              </a>
              <a className="text-button" href="#membership">
                Explore future memberships <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <div className="page home-disclaimer">
          Invite-only pilot. Public signup and real junior enrollment are not
          open. Sample activities are illustrative, noncontact and pending
          qualified review. Practice records show participation, not proven
          improvement. Scholarship and recruiting outcomes are never guaranteed.
        </div>
      </Reveal>
    </main>
  );
}
