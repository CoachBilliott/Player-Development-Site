import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
let db: PGlite;
const id = (n: number) =>
  `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, manager, coach, otherCoach, parent, otherParent] = [
  1, 2, 3, 4, 5, 6,
].map(id);
const profile = id(10),
  sibling = id(11),
  otherProfile = id(12),
  workout = id(20),
  first = id(30),
  second = id(31),
  third = id(32),
  fourth = id(33),
  wrongAge = id(34);
const baseContent = {
  sport: "football",
  title: "First fictional drill",
  skill: "Footwork",
  ages: ["18+"],
  positions: [],
  levels: ["New to the game"],
  minutes: 3,
  equipment: "Paper markers",
  lesson: "Illustrative pending qualified review.",
  steps: ["Walk between the markers."],
  cue: "Controlled steps.",
  kind: "movement",
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of [
    "001-shared-content.sql",
    "002-private-profiles.sql",
    "003-account-levels.sql",
    "004-family-athletes.sql",
    "005-content-audiences.sql",
    "006-assigned-training-and-video-review.sql",
    "007-training-assignment-cleanup.sql",
    "008-workout-builder.sql",
  ])
    await db.exec(
      readFileSync(new URL("../backend/" + file, import.meta.url), "utf8"),
    );
  for (const [n, role] of [
    [1, "owner"],
    [2, "manager"],
    [3, "coach"],
    [4, "coach"],
    [5, "parent"],
    [6, "parent"],
  ] as const) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id(n), `fictional-workout-${n}@example.test`],
    );
    await db.query(
      "insert into public.account_roles(user_id,role) values($1,$2)",
      [id(n), role],
    );
  }
  await db.exec(`insert into public.member_accounts(user_id,account_type) values('${parent}','parent'),('${otherParent}','parent');
 insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal) values
 ('${profile}','${parent}','Fictional adult one','18+','Quarterback','New to the game','Footwork'),
 ('${sibling}','${parent}','Fictional adult two','18+','Defensive back','Experienced','Ball skills'),
 ('${otherProfile}','${otherParent}','Other fictional adult','18+','Quarterback','New to the game','Footwork');`);
  for (const [key, title, age] of [
    [first, "First fictional drill", "18+"],
    [second, "Second fictional drill", "18+"],
    [third, "Third fictional drill", "18+"],
    [fourth, "Fourth fictional drill", "18+"],
    [wrongAge, "Junior-only fictional drill", "5–7"],
  ])
    await db.query(
      `insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values($1,$2,$3,$4,'text/plain','reference.txt','published')`,
      [
        key,
        coach,
        { ...baseContent, title, ages: [age] },
        `${coach}/${key}/${key}.txt`,
      ],
    );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function save(
  actor = coach,
  resources = [second, first],
  version = 0,
  title = "Fictional complete workout",
) {
  await as(actor);
  return (
    await db.query<{ id: string; version: number; resource_ids: string[] }>(
      "select * from public.save_training_workout($1,$2,$3,$4,$5)",
      [
        workout,
        title,
        "Original reviewed-example placeholder.",
        resources,
        version,
      ],
    )
  ).rows[0];
}
async function assign(version = 0, account = parent, templateVersion = 1) {
  await as(owner);
  return (
    await db.query<{ version: number }>(
      "select * from public.assign_training_workout($1,$2,$3,$4)",
      [account, workout, templateVersion, version],
    )
  ).rows[0];
}
async function deny(sql: string, args: unknown[], pattern: RegExp) {
  await db.exec("savepoint denial");
  await expect(db.query(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint denial");
}
it("only authorized staff can create templates and clients cannot bypass RPC writes", async () => {
  await as(parent);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,0)",
    [workout, "No", "", [first]],
    /Staff access/,
  );
  await deny(
    "insert into public.training_workouts(id,title,resource_ids) values($1,$2,$3)",
    [workout, "No", [first]],
    /permission denied/,
  );
});
it("keeps templates private and separates one coach from another", async () => {
  await save();
  await as(otherCoach);
  expect(
    (await db.query("select id from public.training_workouts")).rows,
  ).toEqual([]);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,1)",
    [workout, "Changed", "", [first]],
    /own workouts/,
  );
  await as(parent);
  expect(
    (await db.query("select id from public.training_workouts")).rows,
  ).toEqual([]);
});
it("allows Managers to update a staff template without changing its author", async () => {
  await save();
  await save(manager, [first, second], 1, "Manager revision");
  await as(owner);
  expect(
    (await db.query("select created_by,version from public.training_workouts"))
      .rows,
  ).toEqual([{ created_by: coach, version: 2 }]);
});
it("rejects duplicates, empty and incompatible drill combinations", async () => {
  await as(coach);
  for (const resources of [[], [first, first], [first, wrongAge]])
    await deny(
      "select public.save_training_workout($1,$2,$3,$4,0)",
      [workout, "Invalid", "", resources],
      /1–12 published/,
    );
});
it("rejects total duration beyond the existing sixty-minute reporting limit", async () => {
  await as("", "postgres");
  await db.query(
    "update public.training_resources set content=jsonb_set(content,'{minutes}','20') where id=any($1)",
    [[first, second, third, fourth]],
  );
  await as(coach);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,0)",
    [workout, "Too long", "", [first, second, third, fourth]],
    /60 planned/,
  );
});
it("rejects incompatible experience or position without treating goal as eligibility", async () => {
  await as("", "postgres");
  await db.query(
    "update public.training_resources set content=jsonb_set(content,'{levels}','[\"Experienced\"]') where id=$1",
    [second],
  );
  await as(coach);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,0)",
    [workout, "Mismatch", "", [first, second]],
    /common audience/,
  );
});
it("returns the same version after a lost save response and rejects conflicting stale saves", async () => {
  await save();
  expect((await save()).version).toBe(1);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,0)",
    [workout, "Conflicting", "", [first]],
    /Workout changed/,
  );
});
it("only Owners can preview customer eligibility or assign workouts", async () => {
  await save();
  await as(manager);
  await deny(
    "select public.workout_assignment_preview($1,1,$2)",
    [workout, parent],
    /Owner access/,
  );
  await deny(
    "select public.assign_training_workout($1,$2,1,0)",
    [parent, workout],
    /Only Owners/,
  );
});
it("checks eligibility without exposing player profiles to the Owner", async () => {
  await save();
  await as(owner);
  expect(
    (
      await db.query(
        "select public.workout_assignment_preview($1,1,$2) result",
        [workout, parent],
      )
    ).rows,
  ).toEqual([{ result: { eligible: true } }]);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([]);
});
it("delivers every assigned drill in saved order, without requiring loose grants", async () => {
  await save();
  await assign();
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([{ id: second }, { id: first }]);
  expect(
    (
      await db.query<{ id: string }>("select id from public.training_resources")
    ).rows
      .map((r) => r.id)
      .sort(),
  ).toEqual([first, second].sort());
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.family_profile_state($1) result",
        [profile],
      )
    ).rows[0].result,
  ).toMatchObject({
    assigned_workout: {
      title: "Fictional complete workout",
      resource_ids: [second, first],
      eligible: true,
    },
  });
});
it("preserves snapshot order when the source template is edited", async () => {
  await save();
  await assign();
  await save(coach, [first, second], 1, "Revised template");
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([{ id: second }, { id: first }]);
});
it("prevents another household from reading assignment or plan data", async () => {
  await save();
  await assign();
  await as(otherParent);
  expect(
    (await db.query("select account_id from public.member_workout_assignments"))
      .rows,
  ).toEqual([]);
  expect(
    (await db.query<{ id: string }>("select id from public.training_resources"))
      .rows,
  ).toEqual([]);
  await deny(
    "select public.family_profile_state($1)",
    [profile],
    /not available/,
  );
});
it("keeps a nonmatching sibling on existing loose access instead of a partial workout", async () => {
  await save();
  await assign();
  await as(owner);
  await db.query(
    "select public.set_member_training_access($1,$2,false,null,0)",
    [parent, [third]],
  );
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        sibling,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.family_profile_state($1) result",
        [sibling],
      )
    ).rows[0].result,
  ).toMatchObject({ assigned_workout: { eligible: false } });
});
it("fails closed for the entire program when one resource is withdrawn", async () => {
  await save();
  await assign();
  await as(coach);
  await db.query(
    "update public.training_resources set status='draft' where id=$1",
    [first],
  );
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (await db.query<{ id: string }>("select id from public.training_resources"))
      .rows,
  ).toEqual([]);
});
it("accepts the complete ordered session once and snapshots its name in history", async () => {
  await save(coach, [fourth, third, second, first]);
  await assign();
  await as(parent);
  await db.query("select public.report_athlete_workout($1,$2,$3)", [
    id(50),
    profile,
    [fourth, third, second, first],
  ]);
  await db.query("select public.report_athlete_workout($1,$2,$3)", [
    id(50),
    profile,
    [fourth, third, second, first],
  ]);
  expect(
    (
      await db.query(
        "select workout_title,drill_ids,minutes,status from public.athlete_workouts",
      )
    ).rows,
  ).toEqual([
    {
      workout_title: "Fictional complete workout",
      drill_ids: [fourth, third, second, first],
      minutes: 12,
      status: "approved",
    },
  ]);
});
it("rejects partial or reordered workout completion reports", async () => {
  await save();
  await assign();
  await as(parent);
  for (const requested of [[first], [first, second]])
    await deny(
      "select public.report_athlete_workout($1,$2,$3)",
      [id(50), profile, requested],
      /saved order/,
    );
});
it("preserves history after template removal and revokes program-only access", async () => {
  await save();
  await assign();
  await as(parent);
  await db.query("select public.report_athlete_workout($1,$2,$3)", [
    id(50),
    profile,
    [second, first],
  ]);
  await as(coach);
  await db.query("select public.remove_training_workout($1,1)", [workout]);
  await as(parent);
  expect(
    (
      await db.query(
        "select workout_title,training_workout_id from public.athlete_workouts",
      )
    ).rows,
  ).toEqual([
    { workout_title: "Fictional complete workout", training_workout_id: null },
  ]);
  expect(
    (await db.query<{ id: string }>("select id from public.training_resources"))
      .rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select version,workout_id from public.member_workout_assignments",
      )
    ).rows,
  ).toEqual([{ version: 2, workout_id: null }]);
});
it("keeps assignment revisions monotonic across remove and reassign", async () => {
  await save();
  await assign();
  await as(owner);
  await db.query("select public.assign_training_workout($1,null,0,1)", [
    parent,
  ]);
  expect((await assign(2)).version).toBe(3);
  await deny(
    "select public.assign_training_workout($1,null,0,1)",
    [parent],
    /Assignment changed/,
  );
});
it("makes repeated assignment responses idempotent and preserves video-review settings", async () => {
  await save();
  await as(owner);
  await db.query("select public.set_member_training_access($1,$2,true,$3,0)", [
    parent,
    [third],
    coach,
  ]);
  await assign();
  expect((await assign()).version).toBe(1);
  await as(owner);
  expect(
    (
      await db.query(
        "select resource_ids,video_review_enabled,review_coach_id from public.member_training_access",
      )
    ).rows,
  ).toEqual([
    {
      resource_ids: [third],
      video_review_enabled: true,
      review_coach_id: coach,
    },
  ]);
});
it("does not enable child settings or allow anonymous template access", async () => {
  await as("", "anon");
  await deny("select * from public.training_workouts", [], /permission denied/);
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select under18_enabled,child_self_access_enabled from public.profile_settings",
      )
    ).rows,
  ).toEqual([{ under18_enabled: false, child_self_access_enabled: false }]);
});

it("binds saved-session completion to the assigned template version even with identical drill IDs", async () => {
  await save();
  await assign();
  await save(coach, [second, first], 1, "Revised same drills");
  await assign(1, parent, 2);
  await as(parent);
  await deny(
    "select public.report_saved_workout($1,$2,$3,$4,1)",
    [id(51), profile, [second, first], workout],
    /assigned workout changed/,
  );
  expect(
    (await db.query("select id from public.athlete_workouts")).rows,
  ).toEqual([]);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,2)", [
    id(51),
    profile,
    [second, first],
    workout,
  ]);
  expect(
    (
      await db.query(
        "select workout_title,workout_version from public.athlete_workouts",
      )
    ).rows,
  ).toEqual([{ workout_title: "Revised same drills", workout_version: 2 }]);
});
it("reconciles a lost completion response without relabeling its historical version", async () => {
  await save();
  await assign();
  await as(parent);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(51),
    profile,
    [second, first],
    workout,
  ]);
  await save(coach, [first, second], 1, "Later template");
  await assign(1, parent, 2);
  await as(parent);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(51),
    profile,
    [second, first],
    workout,
  ]);
  expect(
    (
      await db.query(
        "select workout_title,workout_version from public.athlete_workouts",
      )
    ).rows,
  ).toEqual([
    { workout_title: "Fictional complete workout", workout_version: 1 },
  ]);
});
it("does not let a retained minor marker bypass training gates by changing the displayed age", async () => {
  await save();
  await assign();
  await as("", "postgres");
  await db.query(
    "insert into public.family_minor_profiles(profile_id) values($1)",
    [profile],
  );
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([]);
  await deny(
    "select public.report_saved_workout($1,$2,$3,$4,1)",
    [id(52), profile, [second, first], workout],
    /Under-18 workout/,
  );
});
it("rejects a disjoint position audience and does not expose private validation helpers", async () => {
  await as("", "postgres");
  await db.query(
    "update public.training_resources set content=jsonb_set(content,'{positions}','[\"Quarterback\"]') where id=$1",
    [first],
  );
  await db.query(
    "update public.training_resources set content=jsonb_set(content,'{positions}','[\"Defensive back\"]') where id=$1",
    [second],
  );
  await as(coach);
  await deny(
    "select public.save_training_workout($1,$2,$3,$4,0)",
    [workout, "Mismatch", "", [first, second]],
    /common audience/,
  );
  await as(parent);
  await deny(
    "select public.workout_matches_athlete($1,$2)",
    [profile, [first]],
    /permission denied/,
  );
});
it("preserves legitimate loose-drill access for a nonmatching family athlete", async () => {
  await save();
  await assign();
  await as("", "postgres");
  await db.query(
    "update public.training_resources set content=jsonb_set(content,'{levels}','[\"Experienced\"]') where id=$1",
    [third],
  );
  await as(owner);
  await db.query(
    "select public.set_member_training_access($1,$2,false,null,0)",
    [parent, [third]],
  );
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        sibling,
      ])
    ).rows,
  ).toEqual([{ id: third }]);
});
