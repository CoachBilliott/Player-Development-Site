/** Fictional, local-only UI walkthrough. Never a replacement for server/RLS tests. */
import type {
  LearningTransport,
  LearningAthleteData,
  LearningCatalog,
  LearningNotice,
} from "../../src/learning/api";
import { EXAMPLE_QUIZ_CSV, parseQuizCsv } from "../../src/learning/quizImport";
const uid = (n: number) =>
  `92000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const sampleProfiles = [
  { id: uid(1), name: "Fictional Avery" },
  { id: uid(2), name: "Fictional Jordan" },
];
export const sampleActor = uid(5);
const imported = parseQuizCsv(EXAMPLE_QUIZ_CSV).quiz!;
export function learningSimulation(
  role: "owner" | "parent" | "coach" | "other_coach",
  seed?: {
    catalog: LearningCatalog;
    learners: Record<string, LearningAthleteData>;
    notices: LearningNotice[];
  },
) {
  const catalog: LearningCatalog = seed?.catalog || {
    rules: { friday_time: "17:00:00", low_ready_weeks: 2 },
    plans: [
      {
        id: uid(10),
        title: "Fictional two-week pathway",
        weeks: 2,
        package_ids: ["private_test"],
        ages: ["18+"],
        positions: [],
        weeks_content: [1, 2].map((n) => ({
          id: uid(20 + n),
          week_number: n,
          title: `Sample learning week ${n}`,
          revision: 1,
          approved_at: "2026-10-25T05:00:00Z",
          ready: true,
          resources: [],
          quiz_version_ids: [uid(30)],
        })),
      },
    ],
    quizzes: [
      {
        id: uid(30),
        quiz_id: uid(31),
        title: "Fictional format quiz",
        revision: 1,
        total_points: 4,
        questions: imported.questions,
        keys: imported.keys,
      },
    ],
    cohorts: [],
  };
  const learners: Record<string, LearningAthleteData> =
    seed?.learners ||
    Object.fromEntries(
      sampleProfiles.map((p, i) => [
        p.id,
        {
          can_submit: true,
          is_guardian: true,
          enrollments: [
            {
              id: uid(40 + i),
              plan_id: uid(10),
              title: "Fictional two-week pathway",
              state: "active" as const,
              next_week: 2,
              next_release_at: "2026-11-01T05:00:00Z",
              version: 1,
              access_active: true,
              releases: [
                {
                  id: uid(50 + i),
                  sequence: 1,
                  week_number: 1,
                  title: "Sample learning week 1",
                  available_at: "2026-10-25T05:00:00Z",
                  scheduled_at: "2026-10-25T05:00:00Z",
                  content_blocked: false,
                  done: false,
                  resources: [],
                  quizzes: [
                    {
                      id: uid(30),
                      title: "Fictional format quiz",
                      total_points: 4,
                      questions: imported.questions,
                    },
                  ],
                  completion_reviews: [],
                  completed_items: [],
                  attempts: [],
                },
              ],
            },
          ],
        },
      ]),
    );
  const notices: LearningNotice[] = seed?.notices || [];
  function staff() {
    if (role === "parent" || role === "other_coach")
      throw Error("This fictional role has no authoring access.");
  }
  function owner() {
    if (role !== "owner")
      throw Error("Only the fictional Owner can make this change.");
  }
  function allowed(profile: string) {
    if (
      role === "other_coach" ||
      (role === "coach" && profile !== sampleProfiles[0].id)
    )
      throw Error("Athlete is outside this fictional role’s scope.");
  }
  function findRelease(id: string) {
    for (const [profile, data] of Object.entries(learners)) {
      const enrollment = data.enrollments.find((e) =>
        e.releases.some((r) => r.id === id),
      );
      if (enrollment) {
        allowed(profile);
        return {
          profile,
          enrollment,
          release: enrollment.releases.find((r) => r.id === id)!,
        };
      }
    }
    throw Error("Release not found.");
  }
  const api: LearningTransport = {
    async groupResults(group) {
      staff();
      const c = catalog.cohorts.find((c) => c.id === group);
      if (!c) throw Error("Group unavailable.");
      return c.profiles
        .filter((p) => role === "owner" || p === sampleProfiles[0].id)
        .map((p) => ({
          profile_id: p,
          name:
            sampleProfiles.find((x) => x.id === p)?.name || "Fictional athlete",
          releases:
            learners[p]?.enrollments.flatMap((e) => e.releases).length || 0,
          completed_weeks:
            learners[p]?.enrollments
              .flatMap((e) => e.releases)
              .filter((r) => r.done).length || 0,
          quiz_attempts: [],
        }));
    },
    async configureRules(time, threshold) {
      owner();
      catalog.rules = { friday_time: time, low_ready_weeks: threshold };
    },
    async override() {
      throw Error(
        "Individual week overrides are not connected in this fictional adapter.",
      );
    },
    async inbox() {
      return structuredClone(
        notices.filter((n) => {
          try {
            allowed(n.profile_id);
            return role === "parent"
              ? !["no_content", "low_content"].includes(n.category)
              : ["no_content", "low_content"].includes(n.category);
          } catch {
            return false;
          }
        }),
      );
    },
    async readNotice(id) {
      const n = notices.find((n) => n.id === id);
      if (!n) throw Error("Notice unavailable.");
      allowed(n.profile_id);
      n.read = true;
    },
    async catalog() {
      staff();
      const c = structuredClone(catalog);
      if (role === "coach")
        c.cohorts = c.cohorts
          .map((g) => ({
            ...g,
            profiles: g.profiles.filter((p) => p === sampleProfiles[0].id),
          }))
          .filter((g) => g.profiles.length);
      return c;
    },
    async athlete(profile) {
      allowed(profile);
      const data = structuredClone(
        learners[profile] || {
          can_submit: true,
          is_guardian: true,
          enrollments: [],
        },
      );
      return data;
    },
    async importQuiz(title, data, operation) {
      staff();
      if (catalog.quizzes.some((q) => q.id === operation)) return;
      catalog.quizzes.push({
        id: operation,
        quiz_id: operation,
        title,
        revision: 1,
        questions: data.questions,
        keys: data.keys,
        total_points: data.totalPoints,
      });
    },
    async createPlan(id, title, weeks, packages, ages, positions) {
      staff();
      catalog.plans.push({
        id,
        title,
        weeks,
        package_ids: packages,
        ages,
        positions,
        weeks_content: [],
      });
    },
    async saveWeek(id, planId, week, title, resources, quizzes) {
      staff();
      if (resources.length)
        throw Error(
          "This simulation has no lesson media. Use an example quiz; real media upload is not connected.",
        );
      const p = catalog.plans.find((p) => p.id === planId);
      if (!p) throw Error("Plan unavailable.");
      p.weeks_content.push({
        id,
        week_number: week,
        title,
        revision:
          1 + p.weeks_content.filter((w) => w.week_number === week).length,
        approved_at: null,
        ready: false,
        resources: [],
        quiz_version_ids: quizzes,
      });
    },
    async approveWeek(id) {
      owner();
      const w = catalog.plans
        .flatMap((p) => p.weeks_content)
        .find((w) => w.id === id);
      if (!w) throw Error("Week unavailable.");
      w.approved_at = "2026-10-28T19:00:00Z";
      w.ready = true;
    },
    async enroll(id, profile, planId) {
      owner();
      allowed(profile);
      if (
        learners[profile]?.enrollments.some((e) =>
          ["active", "paused"].includes(e.state),
        )
      )
        throw Error("End the current fictional plan first.");
      const p = catalog.plans.find((p) => p.id === planId);
      if (!p) throw Error("Plan unavailable.");
      learners[profile] ||= {
        can_submit: true,
        is_guardian: true,
        enrollments: [],
      };
      learners[profile].enrollments.unshift({
        id,
        plan_id: planId,
        title: p.title,
        state: "active",
        next_week: 1,
        next_release_at: "2026-11-01T05:00:00Z",
        version: 1,
        access_active: true,
        releases: [],
      });
    },
    async control(id, action, version, release) {
      owner();
      const e = Object.values(learners)
        .flatMap((d) => d.enrollments)
        .find((e) => e.id === id);
      if (!e || e.version !== version)
        throw Error("Enrollment changed. Reload.");
      if (action === "pause") e.state = "paused";
      if (action === "resume") e.state = "active";
      if (action === "end") e.state = "ended";
      if (action === "repeat") {
        const old = e.releases.find((r) => r.id === release);
        if (!old) throw Error("Week unavailable.");
        e.releases.unshift({
          ...structuredClone(old),
          id: crypto.randomUUID(),
          sequence: e.releases[0].sequence + 1,
          done: false,
          attempts: [],
          completion_reviews: [],
          completed_items: [],
        });
      }
      e.version++;
    },
    async setAccess() {
      throw Error(
        "Real package eligibility changes are not connected in this preview.",
      );
    },
    async saveCohort(id, title, profiles) {
      owner();
      catalog.cohorts.push({ id, title, profiles });
    },
    async enrollCohort(group, plan, operation) {
      owner();
      const c = catalog.cohorts.find((c) => c.id === group);
      if (!c) throw Error("Group unavailable.");
      if (
        c.profiles.some((p) =>
          learners[p]?.enrollments.some((e) =>
            ["active", "paused"].includes(e.state),
          ),
        )
      )
        throw Error(
          "A selected athlete already has a running plan. Nobody was enrolled.",
        );
      for (const p of c.profiles) await api.enroll(operation + p, p, plan);
    },
    async saveAttempt(id, releaseId, quizId, answers, submit, version) {
      if (role !== "parent")
        throw Error("Only the fictional household can answer this quiz.");
      const { release } = findRelease(releaseId);
      const q = catalog.quizzes.find((q) => q.id === quizId);
      if (!q) throw Error("Quiz unavailable.");
      let a = release.attempts.find((a) => a.id === id);
      if (a && a.version !== version) throw Error("Draft changed. Reload.");
      if (submit && q.questions.some((q) => answers[q.id] === undefined))
        throw Error("Answer every question.");
      const points = submit
        ? q.questions.reduce(
            (n, item) =>
              n +
              (item.type !== "written" &&
              answers[item.id] === q.keys.find((k) => k.id === item.id)?.correct
                ? item.points
                : 0),
            0,
          )
        : null;
      const state = submit
        ? q.questions.some((q) => q.type === "written")
          ? "needs_grading"
          : "graded"
        : "draft";
      a = {
        id,
        quiz_version_id: quizId,
        actor_id: sampleActor,
        answers: structuredClone(answers),
        state,
        objective_points: points,
        submitted_at: submit ? "2026-10-28T19:00:00Z" : null,
        version: (a?.version || 0) + 1,
        grades: [],
      };
      release.attempts = release.attempts.filter((a) => a.id !== id).concat(a);
      if (submit) release.done = true;
      return { id, state, version: a.version, objective_points: points };
    },
    async grade(id, marks, feedback, revision) {
      staff();
      for (const data of Object.values(learners))
        for (const e of data.enrollments)
          for (const r of e.releases) {
            const a = r.attempts.find((a) => a.id === id);
            if (a) {
              findRelease(r.id);
              a.grades.push({
                revision: revision + 1,
                points: marks,
                feedback,
                graded_at: "2026-10-28T19:05:00Z",
              });
              a.state = "graded";
              return;
            }
          }
      throw Error("Attempt unavailable.");
    },
    async reviewCompletion() {
      throw Error("No sample practice reports require guardian review.");
    },
    async complete(release, item) {
      findRelease(release).release.completed_items.push(item);
    },
    async media() {
      throw Error(
        "No demonstration media is uploaded in this fictional walkthrough.",
      );
    },
  };
  return {
    api,
    export: () => structuredClone({ catalog, learners, notices }),
    sunday() {
      for (const [profile, d] of Object.entries(learners))
        for (const e of d.enrollments) {
          if (e.state !== "active") continue;
          const p = catalog.plans.find((p) => p.id === e.plan_id)!;
          const w = p.weeks_content
            .filter((w) => w.week_number === e.next_week && w.ready)
            .at(-1);
          if (!w) {
            notices.push({
              id: crypto.randomUUID(),
              profile_id: profile,
              release_id: null,
              category: "no_content",
              created_at: "2026-11-01T05:00:00Z",
              read: false,
            });
            continue;
          }
          e.releases.unshift({
            id: crypto.randomUUID(),
            sequence: (e.releases[0]?.sequence || 0) + 1,
            week_number: e.next_week,
            title: w.title,
            scheduled_at: "2026-11-01T05:00:00Z",
            available_at: "2026-11-01T05:00:00Z",
            content_blocked: false,
            done: false,
            resources: [],
            quizzes: w.quiz_version_ids.map((id) =>
              catalog.quizzes.find((q) => q.id === id)!,
            ),
            completion_reviews: [],
            completed_items: [],
            attempts: [],
          });
          e.next_week++;
          e.version++;
          e.next_release_at = "2026-11-08T06:00:00Z";
          if (e.next_week > p.weeks) e.state = "finished";
        }
    },
    friday() {
      for (const [profile, d] of Object.entries(learners)) {
        const e = d.enrollments.find(
          (e) => e.state === "active" || e.state === "finished",
        );
        const r = e?.releases[0];
        if (
          r &&
          !r.done &&
          !notices.some(
            (n) => n.release_id === r.id && n.category === "friday_incomplete",
          )
        )
          notices.push({
            id: crypto.randomUUID(),
            profile_id: profile,
            release_id: r.id,
            category: "friday_incomplete",
            created_at: "2026-10-30T22:00:00Z",
            read: false,
          });
      }
    },
  };
}
