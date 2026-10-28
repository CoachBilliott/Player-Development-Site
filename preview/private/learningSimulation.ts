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
export const rosterProfiles = [
  ...sampleProfiles,
  ...Array.from({ length: 50 }, (_, i) => ({
    id: uid(100 + i),
    name: `Fictional Athlete ${String(i + 1).padStart(3, "0")}`,
  })),
];
export type SimulationRole =
  "owner" | "manager" | "parent" | "coach" | "other_coach";
export const sampleActor = uid(5);
const imported = parseQuizCsv(EXAMPLE_QUIZ_CSV).quiz!;
export function learningSimulation(
  role: SimulationRole,
  seed?: {
    catalog: LearningCatalog;
    learners: Record<string, LearningAthleteData>;
    notices: LearningNotice[];
    access?: Record<string, { active: boolean; packageId: string }>;
    overrides?: Record<string, string>;
    assignments?: Record<string, string | null>;
    coachVersions?: Record<string, number>;
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
  for (const profile of rosterProfiles)
    learners[profile.id] ||= {
      can_submit: true,
      is_guardian: true,
      enrollments: [],
    };
  const access =
    seed?.access ||
    Object.fromEntries(
      rosterProfiles.map((p) => [
        p.id,
        { active: true, packageId: "private_test" },
      ]),
    );
  const overrides = seed?.overrides || {};
  const assignments =
    seed?.assignments ||
    Object.fromEntries(
      rosterProfiles.map((p, i) => [
        p.id,
        i === 0 ? sampleActor : i === 1 ? uid(6) : null,
      ]),
    );
  const coachVersions =
    seed?.coachVersions ||
    Object.fromEntries(
      rosterProfiles.map((p) => [p.id, assignments[p.id] ? 1 : 0]),
    );
  const notices: LearningNotice[] =
    seed?.notices ||
    sampleProfiles.map((p) => ({
      id: crypto.randomUUID(),
      profile_id: p.id,
      athlete_name: p.name,
      next_due_at: "2026-11-01T05:00:00Z",
      release_id: null,
      category: "low_content" as const,
      created_at: "2026-10-28T19:00:00Z",
      read: false,
    }));
  function staff() {
    if (role === "parent")
      throw Error("This fictional role has no authoring access.");
  }
  function owner() {
    if (role !== "owner")
      throw Error("Only the fictional Owner can make this change.");
  }
  function allowed(profile: string) {
    if (
      !rosterProfiles.some((p) => p.id === profile) ||
      (role === "parent" && !sampleProfiles.some((p) => p.id === profile)) ||
      role === "other_coach" ||
      (role === "coach" && assignments[profile] !== sampleActor)
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
        .filter((p) => {
          try {
            allowed(p);
            return true;
          } catch {
            return false;
          }
        })
        .map((p) => {
          const releases =
            learners[p]?.enrollments.flatMap((e) => e.releases) || [];
          return {
            profile_id: p,
            name:
              rosterProfiles.find((x) => x.id === p)?.name ||
              "Fictional athlete",
            releases: releases.length,
            completed_weeks: releases.filter((r) => r.done).length,
            quiz_attempts: releases.flatMap((r) =>
              r.attempts.map((a) => ({
                quiz:
                  r.quizzes.find((q) => q.id === a.quiz_version_id)?.title ||
                  "Assigned quiz",
                week_number: r.week_number,
                state: a.state,
                submitted_at: a.submitted_at,
                objective_points: a.objective_points,
                total_points:
                  r.quizzes.find((q) => q.id === a.quiz_version_id)
                    ?.total_points || 0,
                written_points: Object.values(
                  a.grades.at(-1)?.points || {},
                ).reduce((n, v) => n + v, 0),
              })),
            ),
          };
        });
    },
    async configureRules(time, threshold) {
      owner();
      catalog.rules = { friday_time: time, low_ready_weeks: threshold };
    },
    async override(id, week, version) {
      owner();
      const e = Object.values(learners)
        .flatMap((d) => d.enrollments)
        .find((e) => e.id === id);
      const w = catalog.plans
        .find((p) => p.id === e?.plan_id)
        ?.weeks_content.find(
          (w) => w.id === version && w.week_number === week && w.ready,
        );
      if (!e || !w || week < e.next_week)
        throw Error("Choose an approved future week.");
      overrides[id + ":" + week] = version;
    },
    async inbox() {
      return structuredClone(
        notices.filter((n) => {
          try {
            allowed(n.profile_id);
            if (!access[n.profile_id]?.active) return false;
            const current = learners[n.profile_id]?.enrollments.find((e) =>
              ["active", "paused", "finished"].includes(e.state),
            );
            if (
              n.category === "friday_incomplete" &&
              (!current ||
                current.state === "paused" ||
                current.releases[0]?.id !== n.release_id ||
                current.releases[0]?.done)
            )
              return false;
            if (
              ["no_content", "low_content"].includes(n.category) &&
              current?.state !== "active"
            )
              return false;
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
      if (role === "other_coach")
        return {
          rules: structuredClone(catalog.rules),
          plans: [],
          quizzes: [],
          cohorts: [],
        };
      const c = structuredClone(catalog);
      if (role === "coach")
        c.cohorts = c.cohorts
          .map((g) => ({
            ...g,
            profiles: g.profiles.filter((p) => assignments[p] === sampleActor),
            members: g.members.filter((p) => assignments[p.id] === sampleActor),
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
    async importQuiz(title, data, operation, targetQuiz) {
      staff();
      if (catalog.quizzes.some((q) => q.id === operation)) return;
      catalog.quizzes.push({
        id: operation,
        quiz_id: targetQuiz || operation,
        title,
        revision:
          1 +
          Math.max(
            0,
            ...catalog.quizzes
              .filter((q) => q.quiz_id === targetQuiz)
              .map((q) => q.revision),
          ),
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
      if (role !== "owner" && role !== "manager")
        throw Error("Owner or Manager approval is required.");
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
      if (
        !access[profile]?.active ||
        (p.package_ids.length &&
          !p.package_ids.includes(access[profile].packageId))
      )
        throw Error("Verified package eligibility is required.");
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
    async setAccess(profile, packageId, _start, _end, _reason, revoke) {
      owner();
      allowed(profile);
      access[profile] = { active: !revoke, packageId };
      for (const e of learners[profile].enrollments) e.access_active = !revoke;
    },
    async saveCohort(id, title, profiles) {
      owner();
      for (const p of profiles) allowed(p);
      const value = {
        id,
        title,
        profiles,
        members: profiles.map((id) => ({
          id,
          name: rosterProfiles.find((p) => p.id === id)!.name,
        })),
      };
      const old = catalog.cohorts.findIndex((c) => c.id === id);
      if (old >= 0) catalog.cohorts[old] = value;
      else catalog.cohorts.push(value);
    },
    async previewCohort(group, plan) {
      owner();
      const c = catalog.cohorts.find((c) => c.id === group),
        p = catalog.plans.find((p) => p.id === plan);
      if (!c || !p) throw Error("Choose group and plan.");
      const members = c.profiles.map((id) => {
        const e = learners[id]?.enrollments.find((e) =>
          ["active", "paused", "finished"].includes(e.state),
        );
        const state =
          e?.plan_id === plan
            ? "keep_existing"
            : e && ["active", "paused"].includes(e.state)
              ? "different_running_plan"
              : !access[id]?.active ||
                  (p.package_ids.length &&
                    !p.package_ids.includes(access[id].packageId))
                ? "eligibility_needed"
                : "new_enrollment";
        return {
          name: rosterProfiles.find((p) => p.id === id)!.name,
          state: state as
            | "keep_existing"
            | "different_running_plan"
            | "eligibility_needed"
            | "new_enrollment",
        };
      });
      return {
        members,
        new_count: members.filter((m) => m.state === "new_enrollment").length,
        kept_count: members.filter((m) => m.state === "keep_existing").length,
        blocked_count: members.filter(
          (m) => !["new_enrollment", "keep_existing"].includes(m.state),
        ).length,
      };
    },
    async enrollCohort(group, plan) {
      owner();
      const preview = await api.previewCohort(group, plan);
      if (preview.blocked_count)
        throw Error(
          "Resolve eligibility or running-plan conflicts; nobody was enrolled.",
        );
      const c = catalog.cohorts.find((c) => c.id === group)!;
      let count = 0;
      for (const p of c.profiles) {
        if (
          learners[p]?.enrollments.find((e) =>
            ["active", "paused", "finished"].includes(e.state),
          )?.plan_id === plan
        )
          continue;
        await api.enroll(crypto.randomUUID(), p, plan);
        count++;
      }
      return count;
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
      if (submit)
        release.done =
          release.quizzes.every((q) =>
            release.attempts.some(
              (a) => a.quiz_version_id === q.id && a.submitted_at !== null,
            ),
          ) &&
          release.resources.every((r) =>
            release.completed_items.includes(r.id),
          );
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
    export: () =>
      structuredClone({
        catalog,
        learners,
        notices,
        access,
        overrides,
        assignments,
        coachVersions,
      }),
    assignCoach(profile: string, coach: string | null, version: number) {
      if (role !== "owner" && role !== "manager")
        throw Error("Owner or Manager access required.");
      allowed(profile);
      if (coachVersions[profile] !== version) {
        if (
          coachVersions[profile] === version + 1 &&
          assignments[profile] === coach
        )
          return;
        throw Error("Coach assignment changed. Refresh.");
      }
      assignments[profile] = coach;
      coachVersions[profile]++;
    },
    sunday() {
      for (const [profile, d] of Object.entries(learners))
        for (const e of d.enrollments) {
          if (
            e.state !== "active" ||
            !e.access_active ||
            !access[profile]?.active
          )
            continue;
          const p = catalog.plans.find((p) => p.id === e.plan_id)!;
          const w = p.weeks_content
            .filter(
              (w) =>
                w.week_number === e.next_week &&
                w.ready &&
                (!overrides[e.id + ":" + e.next_week] ||
                  w.id === overrides[e.id + ":" + e.next_week]),
            )
            .sort((a, b) => a.revision - b.revision)
            .at(-1);
          if (!w) {
            if (
              !notices.some(
                (n) => n.profile_id === profile && n.category === "no_content",
              )
            )
              notices.push({
                id: crypto.randomUUID(),
                profile_id: profile,
                athlete_name: rosterProfiles.find((p) => p.id === profile)
                  ?.name,
                next_due_at: e.next_release_at,
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
