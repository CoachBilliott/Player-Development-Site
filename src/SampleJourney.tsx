import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Film } from "lucide-react";
import { Tag } from "./components";
import "./sampleJourney.css";

const steps = [
  "IQ lesson",
  "Take the quiz",
  "Practice format",
  "Progress & feedback",
];
const questions = [
  {
    prompt: "What marks each end of the 100-yard field of play?",
    choices: ["The goal lines", "The sidelines", "The halfway line"],
    answer: 0,
    explanation:
      "The field of play runs between the two goal lines. The end zones are beyond them.",
  },
  {
    prompt: "Which lines form the long sides of the field?",
    choices: ["The goal lines", "The sidelines", "The yard numbers"],
    answer: 1,
    explanation: "The sidelines run along the long sides of the field.",
  },
];
type Attempt = { answers: number[]; score: number };

/** Public, memory-only illustration. Not the private quiz runner or gradebook. */
export function SampleJourney() {
  const [step, setStep] = useState(0);
  const [read, setRead] = useState(false);
  const [answers, setAnswers] = useState<number[]>([-1, -1]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [practiceViewed, setPracticeViewed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  function move(next: number) {
    setStep(next);
    setResetting(false);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function reset() {
    setRead(false);
    setAnswers([-1, -1]);
    setAttempts([]);
    setSubmitted(false);
    setPracticeViewed(false);
    setResetting(false);
    setStep(0);
    requestAnimationFrame(() => heading.current?.focus());
  }
  const latest = attempts.at(-1);
  return (
    <main className="page sample-journey">
      <div className="page-intro">
        <Tag>FICTIONAL LEARNING PREVIEW</Tag>
        <h1>One lesson. A clearer next step.</h1>
        <p>
          Explore a sample IQ lesson, a short quiz and the shape of a training
          session. No account required.
        </p>
      </div>
      <aside className="sample-disclosure" aria-label="Preview limits">
        <strong>Illustration only · fictional adult athlete Morgan</strong>
        <p>
          This is one sample lesson, not a complete package week. Text awaits
          review; no demonstration videos are provided. Progress is temporary,
          clears on reload and is never sent to a coach.
        </p>
      </aside>
      <nav className="sample-steps" aria-label="Sample learning steps">
        {steps.map((label, index) => (
          <button
            type="button"
            key={label}
            aria-current={step === index ? "step" : undefined}
            onClick={() => move(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <section className="sample-panel" aria-labelledby="sample-step-title">
        <p className="sample-eyebrow">STEP {step + 1} OF 4</p>
        <h2 id="sample-step-title" ref={heading} tabIndex={-1}>
          {steps[step]}
        </h2>
        {step === 0 && (
          <>
            <h3>Know the field: goal lines and sidelines</h3>
            <p>
              In American football, the field of play is 100 yards long between
              the goal lines. Each end zone extends beyond a goal line.
              Sidelines form the long edges of the field.
            </p>
            <figure className="sample-field">
              <div
                role="img"
                aria-label="Simple field diagram: a 100-yard field of play between two goal lines, with an end zone at each end and sidelines along the long edges."
              >
                <span>End zone</span>
                <span>Goal line</span>
                <strong>100-yard field of play</strong>
                <span>Goal line</span>
                <span>End zone</span>
              </div>
              <figcaption>
                Illustrative diagram, not to scale. Draft lesson text, pending
                review.
              </figcaption>
            </figure>
            <div className="sample-media">
              <Film aria-hidden="true" />
              <div>
                <strong>Lesson video not provided</strong>
                <p>
                  This diagram is an illustration, not a video demonstration.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button"
              onClick={() => {
                setRead(true);
                move(1);
              }}
            >
              Mark sample lesson read & take quiz <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <p>
              Two questions about the sample lesson. This public example is
              scored in your browser; it does not create a trusted grade or
              athlete record.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (submitted || answers.some((answer) => answer < 0)) return;
                setAttempts((previous) => [
                  ...previous,
                  {
                    answers: [...answers],
                    score: answers.filter(
                      (answer, index) => answer === questions[index].answer,
                    ).length,
                  },
                ]);
                setSubmitted(true);
              }}
            >
              {questions.map((question, index) => (
                <fieldset key={question.prompt} disabled={submitted}>
                  <legend>
                    {index + 1}. {question.prompt}
                  </legend>
                  {question.choices.map((choice, choiceIndex) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={`sample-question-${index}`}
                        required
                        checked={answers[index] === choiceIndex}
                        onChange={() =>
                          setAnswers((previous) =>
                            previous.map((value, answerIndex) =>
                              index === answerIndex ? choiceIndex : value,
                            ),
                          )
                        }
                      />
                      {choice}
                    </label>
                  ))}
                </fieldset>
              ))}
              {!submitted && (
                <button className="button" type="submit">
                  Check sample answers
                </button>
              )}
            </form>
            {submitted && latest && (
              <div className="sample-result" role="status">
                <h3>
                  Sample result: {latest.score} / {questions.length}
                </h3>
                {questions.map((question) => (
                  <p key={question.prompt}>{question.explanation}</p>
                ))}
                <p>
                  This checks recall of the sample text, not football ability.
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setAnswers([-1, -1]);
                    setSubmitted(false);
                  }}
                >
                  Try sample quiz again
                </button>
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <h3>What a movement session would show</h3>
            <p>
              Training needs more than a title. A published session should
              provide a reviewed demonstration and clear practice guidance. This
              screen shows that structure without presenting unfinished
              instruction as ready to follow.
            </p>
            <div className="sample-media">
              <Film aria-hidden="true" />
              <div>
                <strong>Reviewed drill demonstration not provided</strong>
                <p>
                  No practice is assigned here. Do not perform a drill from this
                  placeholder.
                </p>
              </div>
            </div>
            <dl className="sample-format">
              <div>
                <dt>Purpose & instructions</dt>
                <dd>Reviewed explanation of what to practice and why.</dd>
              </div>
              <div>
                <dt>Sets, reps, time & rest</dt>
                <dd>
                  Defined for the actual session; no invented prescription in
                  this sample.
                </dd>
              </div>
              <div>
                <dt>Coaching cues</dt>
                <dd>Reviewed points to focus on during practice.</dd>
              </div>
              <div>
                <dt>Equipment & safety</dt>
                <dd>Context appropriate to the athlete and activity.</dd>
              </div>
            </dl>
            <button
              type="button"
              className="button"
              onClick={() => {
                setPracticeViewed(true);
                move(3);
              }}
            >
              View sample progress <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <p>
              Participation, quiz recall and coaching assessment are different
              records. These are only the actions observed in this page.
            </p>
            <dl className="sample-format" aria-label="Sample progress">
              <div>
                <dt>Sample lesson</dt>
                <dd>{read ? "Marked read in this page" : "Not marked read"}</dd>
              </div>
              <div>
                <dt>Sample quiz</dt>
                <dd>
                  {attempts.length
                    ? `${attempts.length} sample attempt${attempts.length === 1 ? "" : "s"}; latest ${latest?.score} / 2`
                    : "Not submitted"}
                </dd>
              </div>
              <div>
                <dt>Practice format</dt>
                <dd>
                  {practiceViewed
                    ? "Format viewed; no practice completed"
                    : "Not marked viewed; no practice completed"}
                </dd>
              </div>
              <div>
                <dt>Technique assessment</dt>
                <dd>No coaching assessment</dd>
              </div>
            </dl>
            {attempts.length > 0 && (
              <details>
                <summary>Sample attempt history</summary>
                <ol>
                  {attempts.map((attempt, index) => (
                    <li key={index}>
                      Attempt {index + 1}: {attempt.score} / 2
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <div className="sample-feedback">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <h3>What coaching feedback would contain</h3>
                <p>
                  A correction, how to improve it and a next-practice
                  recommendation, with guardian-visible history where
                  authorized. No coach has reviewed this fictional example; this
                  is a format preview, not delivered feedback.
                </p>
              </div>
            </div>
            <div className="sample-actions">
              <a className="button" href="#membership">
                Compare packages <ArrowRight size={18} />
              </a>
              <a href="#demo">Explore fictional family practice screens</a>
            </div>
          </>
        )}
      </section>
      <div className="sample-bottom">
        <div className="sample-actions">
          {step > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => move(step - 1)}
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => move(step + 1)}
            >
              Next: {steps[step + 1]} <ArrowRight size={18} />
            </button>
          )}
        </div>
        <button
          ref={resetButton}
          type="button"
          className="text-button"
          onClick={() => setResetting(true)}
        >
          Reset sample
        </button>
      </div>
      {resetting && (
        <div
          className="sample-reset"
          role="region"
          aria-label="Reset sample confirmation"
        >
          <p>Clear this page’s sample answers and progress?</p>
          <div className="sample-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setResetting(false);
                resetButton.current?.focus();
              }}
            >
              Keep my sample
            </button>
            <button type="button" className="button" onClick={reset}>
              Clear sample progress
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
