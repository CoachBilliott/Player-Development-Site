import { DRILLS } from "../../src/data";
import { noAssignment } from "../../src/workouts";
// Isolated review adapter. Never constructs a real Supabase client or sends HTTP.
// All state-changing operations fail explicitly; role selection is a visual fixture.
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { AccountRole } from "../../src/roles";
import { isStaff } from "../../src/roles";
import type { SharedState } from "../../src/useSharedContent";
import { SharedContent } from "../../src/sharedContent";
import {
  coachA,
  coachB,
  sampleRows,
  sampleNextAction,
  uid,
} from "../staff/data";

const disabled = () => ({
  data: null,
  error: {
    message:
      "Read-only fictional preview. No real account action is connected.",
  },
});
export function previewShared(
  role: AccountRole | null,
  signOut: () => void,
): SharedState {
  const actor =
    role === "coach"
      ? coachA
      : uid(
          role === "manager"
            ? 2
            : role === "parent"
              ? 4
              : role === "athlete"
                ? 5
                : 1,
        );
  const user = {
    id: actor,
    email: `fictional-${role || "visitor"}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    email_confirmed_at: "2026-01-01T00:00:00Z",
  };
  const player = {
    id: uid(300),
    owner_id: actor,
    nickname: "Fictional Avery",
    age_group: "18+",
    sport: "football",
    position: "Quarterback",
    experience: "New to the game",
    goal: "Footwork",
    guardian_confirmed: false,
    version: 1,
  };
  const sample = sampleRows();
  const lesson = {
    ...DRILLS[0],
    id: uid(90),
    title: "Controlled steps · illustrative sample",
    ages: ["18+" as const],
    levels: ["New to the game" as const],
    positions: [],
    source: "shared" as const,
    visibility: "member_only" as const,
    reviewStage: "approved" as const,
    assetId: undefined,
    createdBy: actor,
    version: 1,
  };
  const savedWorkouts = isStaff(role)
    ? [
        {
          id: uid(80),
          title: "Ready position & controlled steps",
          summary: "Illustrative noncontact practice for design review.",
          resource_ids: [lesson.id],
          created_by: actor,
          version: 1,
          updated_at: "2026-10-28T12:00:00Z",
        },
      ]
    : [];

  const allowed = (row: ReturnType<typeof sampleRows>[number]) =>
    role !== "coach" || row.coach_id === coachA;
  const view = (row: ReturnType<typeof sampleRows>[number]) => ({
    ...row,
    next_action: sampleNextAction(row),
    ...(role === "coach" ? { review_scope: "assigned_only" } : {}),
  });
  const account = {
    user_id: actor,
    account_type: role === "parent" ? "parent" : "adult",
    privacy_version: "fictional-preview",
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signInWithPassword: async () => disabled(),
      resetPasswordForEmail: async () => disabled(),
      resend: async () => disabled(),
      updateUser: async () => disabled(),
      signOut: async () => {
        signOut();
        return { error: null };
      },
    },
    functions: { invoke: async () => disabled() },
    from(table: string) {
      let single = false,
        write = false;
      const equals: Record<string, unknown> = {};
      const data = () =>
        table === "training_workouts"
          ? savedWorkouts
          : table === "member_training_access" && role === "owner"
            ? [
                {
                  account_id: uid(50),
                  resource_ids: [],
                  video_review_enabled: false,
                  review_coach_id: null,
                  version: 0,
                },
              ]
            : table === "member_accounts"
              ? [account]
              : table === "profile_settings"
                ? [{ under18_enabled: false }]
                : table === "player_profiles" && !isStaff(role)
                  ? [player]
                  : table === "account_roles" && role
                    ? [{ role, version: 1 }]
                    : [];
      const q: Record<string, unknown> = {};
      for (const method of [
        "select",
        "neq",
        "order",
        "limit",
        "range",
        "in",
        "is",
        "or",
        "not",
        "match",
      ])
        q[method] = () => q;
      q.eq = (key: string, value: unknown) => {
        equals[key] = value;
        return q;
      };
      for (const method of ["insert", "update", "upsert", "delete"])
        q[method] = () => {
          write = true;
          return q;
        };
      q.single = q.maybeSingle = () => {
        single = true;
        return q;
      };
      q.then = (resolve: (result: unknown) => unknown) => {
        const rows = data().filter((row) =>
          Object.entries(equals).every(
            ([key, value]) =>
              !(key in row) || (row as Record<string, unknown>)[key] === value,
          ),
        );
        return Promise.resolve(
          write
            ? disabled()
            : { data: single ? rows[0] || null : rows, error: null },
        ).then(resolve);
      };
      return q;
    },
    async rpc(name: string, body: Record<string, unknown> = {}) {
      let data: unknown;
      if (name === "workout_assignment_profiles" && role === "owner")
        data = sample
          .filter((r) => r.client_id === body.target_account)
          .map((r) => ({
            id: r.athlete_id,
            nickname: r.athlete_name,
            age_group: r.age_group,
            position: r.position,
          }));
      else if (name === "profile_workout_assignment" && role === "owner") {
        const row = sample.find(
          (r) =>
            r.client_id === body.target_account &&
            r.athlete_id === body.target_profile,
        );
        if (!row) return disabled();
        data = row.workout_id
          ? {
              ...noAssignment,
              workout_id: row.workout_id,
              workout_title: row.workout_title,
              resource_ids: row.resources.map((r) => r.id),
              workout_version: row.workout_version,
              version: 1,
            }
          : noAssignment;
      } else if (name === "profile_workout_preview" && role === "owner")
        data = {
          eligible:
            sample.some(
              (r) =>
                r.client_id === body.target_account &&
                r.athlete_id === body.target_profile,
            ) && savedWorkouts.some((w) => w.id === body.workout),
        };
      else if (name === "staff_client_service_roster" && isStaff(role))
        data = {
          source: "account_backend",
          scope:
            role === "coach" ? "assigned_athletes" : "all_repformed_clients",
          rows: sample.filter(allowed).map(view),
          coaches:
            role === "coach"
              ? []
              : [
                  { id: coachA, label: "Fictional Coach Alex" },
                  { id: coachB, label: "Fictional Coach Blair" },
                ],
        };
      else if (name === "staff_athlete_service" && isStaff(role)) {
        const row = sample.find(
          (r) => r.athlete_id === body.target_profile && allowed(r),
        );
        return row ? { data: view(row), error: null } : disabled();
      } else if (name === "list_account_access" && role === "owner")
        data = (["owner", "manager", "coach", "parent", "athlete"] as const)
          .map((r, i) => ({
            user_id: r === "coach" ? coachA : uid(i + 1),
            email: `fictional-${r}@example.test`,
            role: r,
            version: 1,
            email_verified: true,
            adult_setup: true,
          }))
          .concat([
            {
              user_id: uid(50),
              email: "fictional-family@example.test",
              role: "parent",
              version: 1,
              email_verified: true,
              adult_setup: true,
            },
            {
              user_id: uid(51),
              email: "fictional-solo@example.test",
              role: "athlete",
              version: 1,
              email_verified: true,
              adult_setup: true,
            },
          ])
          .filter((r) => r.email.includes(String(body.search_text || "")));
      else if (
        name === "interest_staff_inbox" &&
        (role === "owner" || role === "manager")
      )
        data = [
          {
            id: uid(240),
            adult_name: "Fictional Adult",
            email: "fictional-adult@example.test",
            package_interest: "foundation",
            created_at: "2026-10-28T12:00:00Z",
            email_state: "disabled",
            launch_choice: false,
            launch_choice_at: "2026-10-28T12:00:00Z",
            launch_notice_version: "repformed-launch-notice-v1",
          },
        ];
      else if (name === "athlete_account_context")
        data = { guardian_managed: false, linked_profile_id: null };
      else if (name === "family_profile_state" && !isStaff(role))
        data = {
          guardian_managed: false,
          is_family: role === "parent",
          is_parent: role === "parent",
          can_record: true,
          self_recording_allowed: false,
          permission_version: 0,
          has_link: false,
          child_access_ready: false,
          workouts: [],
          assigned_workout: null,
        };
      else if (
        ["list_account_invitations", "list_account_closure_requests"].includes(
          name,
        ) &&
        role === "owner"
      )
        data = [];
      else if (name === "my_account_invitation") data = null;
      else if (name === "account_lifecycle_state")
        data = {
          eligible: !isStaff(role),
          reason: isStaff(role) ? "owner_transfer" : "",
          request_id: null,
          state: "none",
          profile_count: isStaff(role) ? 0 : 1,
          video_count: 0,
        };
      else if (
        [
          "athlete_training_resources",
          "member_training_resources",
          "staff_training_resources",
        ].includes(name)
      )
        data = [];
      else return disabled();
      return { data, error: null };
    },
  } as unknown as SupabaseClient;
  const session: Session | null = role
    ? {
        access_token: "fictional-not-a-token",
        refresh_token: "fictional-not-a-token",
        expires_in: 0,
        token_type: "bearer",
        user,
      }
    : null;
  const noop = async () => {};
  const unavailable = async () => {
    throw new Error(
      "Read-only fictional preview. This action is not connected.",
    );
  };
  return {
    interestEndpoint: "preview-only",
    learningPlansEnabled: false,
    interestLoading: false,
    service: new SharedContent(client),
    accountLifecycleEnabled: true,
    serviceTrackingEnabled: false,
    staffRosterEnabled: true,
    staffNotificationEmailsEnabled: false,
    deliveryMonitoringEnabled: false,
    accountNotice: "",
    setAccountNotice: () => {},
    session,
    loading: false,
    membersEnabled: true,
    signupEnabled: false,
    connectionError: "",
    clearConnectionError: () => {},
    configured: true,
    signedIn: Boolean(role),
    role,
    accessReady: true,
    accessError: "",
    refreshAccess: noop,
    coach: isStaff(role),
    canEditResource: (id: string) => isStaff(role) && id === lesson.id,
    checking: false,
    libraryReady: true,
    resources: isStaff(role) ? [lesson] : [],
    error: "",
    message: "",
    refresh: noop,
    signIn: unavailable,
    signOut: async () => signOut(),
    uploadProgress: null,
    publish: unavailable,
    update: unavailable,
    remove: unavailable,
  };
}
