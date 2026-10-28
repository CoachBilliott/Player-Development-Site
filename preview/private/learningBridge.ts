/** Local-only transport for actual workspace components; never creates a client. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningAttempt } from "../../src/learning/api";
import type { QuizImport } from "../../src/learning/quizImport";
import {
  serviceRows,
  serviceState,
  serviceAction,
} from "../../src/staffServiceView";
import type { StaffAthlete, RosterCursor } from "../../src/staffService";
import {
  learningSimulation,
  rosterProfiles,
  sampleActor,
  type SimulationRole,
} from "./learningSimulation";
type Simulation = ReturnType<typeof learningSimulation>;
const secondCoach = "92000000-0000-4000-8000-000000000006";
export function learningBridge(
  sim: Simulation,
  role: SimulationRole,
): SupabaseClient {
  const coaches = [
    { id: sampleActor, label: "Fictional assigned coach" },
    { id: secondCoach, label: "Fictional second coach" },
  ];
  async function row(profile: string): Promise<StaffAthlete> {
    const data = await sim.api.athlete(profile),
      snapshot = sim.export(),
      person = rosterProfiles.find((p) => p.id === profile)!;
    const e = data.enrollments.find((e) =>
        ["active", "paused", "finished"].includes(e.state),
      ),
      r = e?.releases[0],
      p = snapshot.catalog.plans.find((p) => p.id === e?.plan_id);
    let ready = 0;
    if (e && p)
      while (
        e.next_week + ready <= p.weeks &&
        p.weeks_content.some(
          (w) => w.week_number === e.next_week + ready && w.ready,
        )
      )
        ready++;
    const grades = data.enrollments
      .flatMap((e) => e.releases)
      .flatMap((r) => r.attempts)
      .filter((a) => a.state === "needs_grading").length;
    const state = !e
      ? "not_enrolled"
      : !e.access_active
        ? "access_inactive"
        : e.state === "paused"
          ? "paused"
          : grades
            ? "needs_grading"
            : e.state === "active" && p && e.next_week <= p.weeks && !ready
              ? "needs_content"
              : !r
                ? "awaiting_release"
                : r.done
                  ? e.state === "finished"
                    ? "plan_complete"
                    : "week_complete"
                  : "ready";
    const learning = {
      enabled: true as const,
      status: state as NonNullable<StaffAthlete["learning"]>["status"],
      enrollment_id: e?.id || null,
      title: e?.title || null,
      plan_id: e?.plan_id,
      enrollment_state: e?.state,
      access_active: e?.access_active,
      current_week: r?.week_number ?? null,
      current_title: r?.title || null,
      current_release_id: r?.id || null,
      available_at: r?.available_at || null,
      scheduled_at: r?.scheduled_at || null,
      next_week: e?.next_week,
      next_release_at: e?.state === "active" ? e.next_release_at : null,
      ready_weeks: ready,
      total_weeks: p?.weeks,
      pending_grades: grades,
      pending_parent: 0,
      last_reported_at:
        r?.attempts.find((a) => a.submitted_at)?.submitted_at || null,
    };
    const coach = snapshot.assignments[profile];
    const result: StaffAthlete = {
      client_id: "92000000-0000-4000-8000-000000000090",
      client_label:
        role === "coach" || role === "other_coach"
          ? "Fictional assigned client"
          : "Fictional adult household",
      athlete_id: profile,
      athlete_name: person.name,
      age_group: "18+",
      position: "Quarterback",
      experience: "New to the game",
      goal: "Fictional learning",
      coach_id: coach,
      coach_label: coaches.find((c) => c.id === coach)?.label || null,
      coach_version: snapshot.coachVersions[profile],
      workout_id: null,
      workout_title: "",
      eligible_access: false,
      media_ready: false,
      resources: [],
      review_tasks: [],
      pending_reviews: 0,
      overdue_reviews: 0,
      blocked_reviews: 0,
      next_action: "View weekly training",
      learning,
    };
    result.next_action = serviceAction(result, role);
    return result;
  }
  const denied = () => {
    throw Error("This action is not part of the fictional weekly walkthrough.");
  };
  return {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        let data: unknown = null;
        if (name === "staff_learning_roster_page") {
          if (role === "parent") throw Error("Staff access required.");
          const all: StaffAthlete[] = [];
          for (const p of rosterProfiles) {
            try {
              all.push(await row(p.id));
            } catch {
              /* scope denial excludes this fictional record */
            }
          }
          const scoped = all.filter(
            (r) =>
              (!args.age_filter || r.age_group === args.age_filter) &&
              (!args.position_filter || r.position === args.position_filter) &&
              (!args.coach_filter ||
                (args.coach_filter === "none"
                  ? !r.coach_id
                  : r.coach_id === args.coach_filter)),
          );
          const searched = serviceRows(
              scoped,
              String(args.search_text || ""),
              "all",
            ),
            filtered = serviceRows(
              scoped,
              String(args.search_text || ""),
              String(args.status_filter || "all"),
            );
          const cursor = args.after_cursor as RosterCursor | null;
          const start = cursor
              ? filtered.findIndex((r) => r.athlete_id === cursor.key) + 1
              : 0,
            size = Number(args.page_size || 25),
            rows = filtered.slice(start, start + size),
            last = rows.at(-1);
          data = {
            source: "account_backend",
            scope:
              role === "coach" || role === "other_coach"
                ? "assigned_athletes"
                : "all_repformed_clients",
            rows,
            coaches:
              role === "owner" || role === "manager"
                ? coaches
                : coaches.filter((c) => c.id === sampleActor),
            page: {
              total: searched.length,
              matched: filtered.length,
              athletes: all.length,
              clients: all.length ? 1 : 0,
              counts: {
                overdue: searched.filter((r) => serviceState(r) === "overdue")
                  .length,
                attention: searched.filter(
                  (r) => serviceState(r) === "attention",
                ).length,
                ready: searched.filter((r) => serviceState(r) === "ready")
                  .length,
              },
              ages: ["18+"],
              positions: ["Quarterback"],
              next_cursor:
                start + size < filtered.length && last
                  ? {
                      priority:
                        serviceState(last) === "overdue"
                          ? 0
                          : serviceState(last) === "attention"
                            ? 1
                            : 2,
                      label: last.athlete_name!,
                      key: last.athlete_id!,
                    }
                  : null,
            },
          };
        } else if (name === "staff_athlete_service") {
          if (role === "parent") throw Error("Staff access required.");
          data = await row(String(args.target_profile));
        } else if (name === "assign_athlete_service_coach")
          sim.assignCoach(
            String(args.target_profile),
            args.coach ? String(args.coach) : null,
            Number(args.expected_version),
          );
        else if (name === "learning_catalog") data = await sim.api.catalog();
        else if (name === "learning_athlete")
          data = await sim.api.athlete(String(args.target_profile));
        else if (name === "learning_inbox") data = await sim.api.inbox();
        else if (name === "learning_read_notice")
          await sim.api.readNotice(String(args.target_notice));
        else if (name === "learning_import_quiz")
          await sim.api.importQuiz(
            String(args.quiz_title),
            args.payload as QuizImport,
            String(args.version_id),
            String(args.target_quiz),
          );
        else if (name === "learning_create_plan")
          await sim.api.createPlan(
            String(args.target_id),
            String(args.plan_title),
            Number(args.week_count),
            args.packages as string[],
            args.age_groups as string[],
            args.position_groups as string[],
          );
        else if (name === "learning_save_week")
          await sim.api.saveWeek(
            String(args.target_id),
            String(args.target_plan),
            Number(args.week_no),
            String(args.week_title),
            args.resource_ids as string[],
            args.quizzes as string[],
          );
        else if (name === "learning_approve_week")
          await sim.api.approveWeek(String(args.target_week));
        else if (name === "learning_enroll")
          await sim.api.enroll(
            String(args.target_id),
            String(args.target_profile),
            String(args.target_plan),
          );
        else if (name === "learning_control")
          await sim.api.control(
            String(args.target_enrollment),
            args.action_name as "pause" | "resume" | "end" | "repeat",
            Number(args.expected_version),
            args.target_release ? String(args.target_release) : undefined,
          );
        else if (name === "learning_set_access")
          await sim.api.setAccess(
            String(args.target_profile),
            String(args.package_name),
            String(args.starts),
            String(args.ends),
            String(args.reason_text),
            !!args.revoke,
          );
        else if (name === "learning_set_override")
          await sim.api.override(
            String(args.target_enrollment),
            Number(args.week_no),
            String(args.target_week),
          );
        else if (name === "learning_save_cohort")
          await sim.api.saveCohort(
            String(args.target_id),
            String(args.cohort_title),
            args.profiles as string[],
          );
        else if (name === "learning_group_enrollment_preview")
          data = await sim.api.previewCohort(
            String(args.target_cohort),
            String(args.target_plan),
          );
        else if (name === "learning_enroll_cohort")
          data = await sim.api.enrollCohort(
            String(args.target_cohort),
            String(args.target_plan),
            String(args.operation_id),
          );
        else if (name === "learning_group_results")
          data = await sim.api.groupResults(String(args.target_cohort));
        else if (name === "learning_configure_rules")
          await sim.api.configureRules(
            String(args.friday_clock),
            Number(args.ready_threshold),
          );
        else if (name === "learning_save_attempt")
          data = await sim.api.saveAttempt(
            String(args.target_attempt),
            String(args.target_release),
            String(args.target_quiz),
            args.responses as LearningAttempt["answers"],
            !!args.submit,
            Number(args.expected_version),
          );
        else if (name === "learning_grade_written")
          await sim.api.grade(
            String(args.target_attempt),
            args.marks as Record<string, number>,
            String(args.feedback_text),
            Number(args.expected_revision),
          );
        else if (name === "learning_complete")
          await sim.api.complete(
            String(args.target_release),
            String(args.item),
          );
        else if (name === "learning_review_completion")
          await sim.api.reviewCompletion(
            String(args.target_release),
            String(args.item),
            args.decision as "approved" | "needs_repeat",
            Number(args.expected_version),
          );
        else denied();
        return { data, error: null };
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error
                ? error.message
                : "Fictional action failed.",
          },
        };
      }
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: null,
          error: {
            message:
              "No demonstration media is uploaded in this fictional walkthrough.",
          },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}
