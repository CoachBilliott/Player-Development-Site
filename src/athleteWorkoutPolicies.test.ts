import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
let db: PGlite;
const id = (n: number) =>
  `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, manager, coach, , parent, otherParent] = [1, 2, 3, 4, 5, 6].map(
  id,
);
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
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated',created_at timestamptz default now());
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
    "009-content-review-and-practice-resume.sql",
    "010-account-invitations-and-closure.sql",
    "011-review-service-tracking.sql",
    "012-per-athlete-workout-assignments.sql",
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
  await db.exec(`update public.member_accounts set adult_confirmed_at=now(),privacy_acknowledged_at=now();
  update public.training_resources set content=jsonb_set(content,'{levels}','["Experienced"]') where id='${second}';
  update public.training_resources set review_stage='approved',status='published';`);
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
const siblingWorkout = id(21);
async function templates() {
  await as(coach);
  for (const [key, title, resources] of [
    [workout, "Fictional QB practice", [first]],
    [siblingWorkout, "Fictional DB practice", [second]],
  ] as const)
    await db.query(
      "select public.save_training_workout($1,$2,'Illustrative adult draft',$3,0)",
      [key, title, resources],
    );
}
async function setPlan(
  p = profile,
  w: string | null = workout,
  version = 0,
  account = parent,
  templateVersion = 1,
) {
  await as(owner);
  return (
    await db.query<{ version: number }>(
      "select * from public.assign_profile_workout($1,$2,$3,$4,$5)",
      [account, p, w, w ? templateVersion : 0, version],
    )
  ).rows[0];
}
async function deny(sql: string, args: unknown[], pattern: RegExp) {
  await db.exec("savepoint denial");
  await expect(db.query(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint denial");
}
async function plan(p: string) {
  return (
    await db.query<{ id: string }>(
      "select id from public.athlete_training_plan($1)",
      [p],
    )
  ).rows.map((r) => r.id);
}
it("keeps two adult sibling plans, access, histories and ordered completion independent", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  await as(parent);
  expect(await plan(profile)).toEqual([first]);
  expect(await plan(sibling)).toEqual([second]);
  await deny(
    "select public.report_saved_workout($1,$2,$3,$4,1)",
    [id(50), profile, [second], siblingWorkout],
    /assigned workout changed/,
  );
  for (const [key, p, drill, w] of [
    [50, profile, first, workout],
    [51, sibling, second, siblingWorkout],
  ] as const) {
    await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
      id(key),
      p,
      [drill],
      w,
    ]);
    await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
      id(key),
      p,
      [drill],
      w,
    ]);
  }
  expect(
    (
      await db.query(
        "select profile_id,training_workout_id,status from public.athlete_workouts order by profile_id",
      )
    ).rows,
  ).toEqual([
    { profile_id: profile, training_workout_id: workout, status: "approved" },
    {
      profile_id: sibling,
      training_workout_id: siblingWorkout,
      status: "approved",
    },
  ]);
  const state = (
    await db.query<{ result: { assigned_workout: { id: string } } }>(
      "select public.family_profile_state($1) result",
      [sibling],
    )
  ).rows[0].result;
  expect(state.assigned_workout.id).toBe(siblingWorkout);
});
it("denies raw writes, internal helper access and non-Owner assignment or customer-directory access", async () => {
  await templates();
  for (const user of [manager, coach, parent, otherParent]) {
    await as(user);
    await deny(
      "select public.assign_profile_workout($1,$2,$3,1,0)",
      [parent, profile, workout],
      /Owner access/,
    );
    await deny(
      "select * from public.workout_assignment_profiles($1)",
      [parent],
      /Owner access/,
    );
    await deny(
      "select public.effective_workout_assignment($1)",
      [profile],
      /permission denied/,
    );
    await deny(
      "insert into public.athlete_workout_assignments(profile_id,version) values($1,1)",
      [profile],
      /permission denied/,
    );
  }
  await as("", "anon");
  await deny(
    "select * from public.athlete_workout_assignments",
    [],
    /permission denied/,
  );
});
it("isolates another household and rejects profile/account substitution even for an Owner", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  await as(otherParent);
  expect(
    (
      await db.query(
        "select profile_id from public.athlete_workout_assignments",
      )
    ).rows,
  ).toEqual([]);
  await deny(
    "select * from public.athlete_training_plan($1)",
    [profile],
    /unavailable/,
  );
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,$3,1,0)",
    [otherParent, profile, workout],
    /athlete in this customer/,
  );
  await as(parent);
  expect(
    (
      await db.query(
        "select profile_id from public.athlete_workout_assignments order by profile_id",
      )
    ).rows,
  ).toEqual([{ profile_id: profile }, { profile_id: sibling }]);
});
it("requires verified adult customer setup and rejects incompatible or closed-junior targets without changing access", async () => {
  await templates();
  await setPlan();
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,$3,1,1)",
    [parent, profile, siblingWorkout],
    /does not match/,
  );
  await as("", "postgres");
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    otherParent,
  ]);
  await as(owner);
  await deny(
    "select * from public.workout_assignment_profiles($1)",
    [otherParent],
    /verified adult/,
  );
  await as("", "postgres");
  await db.exec("update public.profile_settings set under18_enabled=true");
  await db.query(
    "update public.player_profiles set age_group='8–12',guardian_confirmed=true where id=$1",
    [sibling],
  );
  await db.exec("update public.profile_settings set under18_enabled=false");
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,$3,1,0)",
    [parent, sibling, siblingWorkout],
    /does not match/,
  );
  await as(parent);
  expect(await plan(profile)).toEqual([first]);
  expect(await plan(sibling)).toEqual([]);
});
it("preserves a legacy default until explicitly overridden; removing a profile plan never restores that default", async () => {
  await templates();
  await as(owner);
  await db.query("select public.assign_training_workout($1,$2,1,0)", [
    parent,
    workout,
  ]);
  await as(parent);
  expect(await plan(profile)).toEqual([first]);
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,$3,1,0)",
    [parent, profile, workout],
    /Assignment changed/,
  );
  expect((await setPlan(profile, workout, 1)).version).toBe(2);
  expect((await setPlan(profile, workout, 1)).version).toBe(2);
  await setPlan(sibling, siblingWorkout, 1);
  await setPlan(profile, null, 2);
  await as(parent);
  expect(await plan(profile)).toEqual([]);
  expect(await plan(sibling)).toEqual([second]);
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,$3,1,1)",
    [parent, profile, workout],
    /Assignment changed/,
  );
});
it("invalidates only the changed sibling's saved practice and keeps the other resume available", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  await as(parent);
  for (const [p, session, drill, w] of [
    [profile, id(70), first, workout],
    [sibling, id(71), second, siblingWorkout],
  ]) {
    const resourceVersion = (
      await db.query<{ version: number }>(
        "select version from public.training_resources where id=$1",
        [drill],
      )
    ).rows[0].version;
    await db.query("select public.save_practice_resume($1,$2,$3,$4,0,0,$5,1)", [
      p,
      session,
      [drill],
      [resourceVersion],
      w,
    ]);
  }
  await setPlan(profile, null, 1);
  await as(parent);
  expect(
    (await db.query("select public.load_practice_resume($1) result", [profile]))
      .rows,
  ).toEqual([{ result: null }]);
  expect(
    (
      await db.query<{ result: { session_id: string } }>(
        "select public.load_practice_resume($1) result",
        [sibling],
      )
    ).rows[0].result.session_id,
  ).toBe(id(71));
});
it("preserves review-note redaction, removes withdrawn content and clears only assignments of a deleted template", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  await as("", "postgres");
  await db.query(
    "update public.training_resources set review_notes='Internal staff note' where id=$1",
    [first],
  );
  await as(parent);
  expect(
    (
      await db.query<{ review_notes: string }>(
        "select review_notes from public.athlete_training_plan($1)",
        [profile],
      )
    ).rows[0].review_notes,
  ).toBe("");
  await as(coach);
  await db.query("select public.remove_training_workout($1,1)", [workout]);
  await as(parent);
  expect(await plan(profile)).toEqual([]);
  expect(await plan(sibling)).toEqual([second]);
  await as("", "postgres");
  await db.query(
    "update public.training_resources set review_stage='changes_requested',status='draft' where id=$1",
    [second],
  );
  await as(parent);
  expect(await plan(sibling)).toEqual([]);
});
it("freezes assignment management during account erasure and cascades athlete deletion", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  await as("", "postgres");
  await db.query(
    "insert into public.account_closures(id,user_id,state) values($1,$2,'cleaning')",
    [id(80), parent],
  );
  await as(owner);
  await deny(
    "select public.assign_profile_workout($1,$2,null,0,1)",
    [parent, profile],
    /verified adult/,
  );
  await as(parent);
  expect(
    (await db.query("select * from public.athlete_workout_assignments")).rows,
  ).toEqual([]);
  await as("", "postgres");
  await db.query("delete from public.player_profiles where id=$1", [profile]);
  expect(
    (
      await db.query(
        "select profile_id from public.athlete_workout_assignments",
      )
    ).rows,
  ).toEqual([{ profile_id: sibling }]);
});
it("keeps a linked adult athlete limited to their own plan and preserves parent pause and revocation", async () => {
  await templates();
  await setPlan();
  await setPlan(sibling, siblingWorkout);
  const linked = id(7);
  await as("", "postgres");
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-linked@example.test',now())",
    [linked],
  );
  await db.query(
    "insert into public.account_roles(user_id,role) values($1,'athlete')",
    [linked],
  );
  await db.query(
    "insert into public.family_athlete_links(profile_id,athlete_user_id) values($1,$2)",
    [profile, linked],
  );
  await as(linked);
  expect(
    (
      await db.query(
        "select profile_id from public.athlete_workout_assignments",
      )
    ).rows,
  ).toEqual([{ profile_id: profile }]);
  expect(await plan(profile)).toEqual([first]);
  await deny(
    "select * from public.athlete_training_plan($1)",
    [sibling],
    /unavailable/,
  );
  await deny(
    "select public.report_saved_workout($1,$2,$3,$4,1)",
    [id(90), profile, [first], workout],
    /parent has paused/,
  );
  await as("", "postgres");
  await db.query(
    "insert into public.family_athlete_controls(profile_id,self_recording_allowed) values($1,true) on conflict(profile_id) do update set self_recording_allowed=true",
    [profile],
  );
  await as(linked);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(90),
    profile,
    [first],
    workout,
  ]);
  expect(
    (await db.query("select status from public.athlete_workouts")).rows,
  ).toEqual([{ status: "pending_parent" }]);
  await as("", "postgres");
  await db.query(
    "update public.family_athlete_links set revoked_at=now() where profile_id=$1",
    [profile],
  );
  await as(linked);
  expect(
    (await db.query("select * from public.athlete_workout_assignments")).rows,
  ).toEqual([]);
  await deny(
    "select * from public.athlete_training_plan($1)",
    [profile],
    /unavailable/,
  );
});
