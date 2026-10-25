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
    "009-content-review-and-practice-resume.sql",
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
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  for (const key of [first, second, third, fourth, wrongAge]) {
    await db.query("select public.review_training_resource($1,'submit','',1)", [
      key,
    ]);
    await db.query(
      "select public.review_training_resource($1,'approve','Fictional technical test release',2)",
      [key],
    );
  }
  await db.query("select set_config('request.jwt.claim.sub','',false)");
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
async function pause(actor = parent, version = 0, index = 0, session = id(80)) {
  await as(actor);
  return (
    await db.query<{
      result: { version: number; current_index: number; session_id: string };
    }>("select public.save_practice_resume($1,$2,$3,$4,$5,$6,$7,1) as result", [
      profile,
      session,
      [second, first],
      [3, 3],
      index,
      version,
      workout,
    ])
  ).rows[0].result;
}
it("new content is private draft and direct clients cannot approve or publish it", async () => {
  await as(coach);
  const resource = id(50);
  await db.query(
    "insert into public.training_resources(id,content,asset_path,asset_type,asset_name,visibility) values($1,$2,$3,'text/plain','new.txt','public_sample')",
    [resource, baseContent, `${coach}/${resource}/${resource}.txt`],
  );
  expect(
    (
      await db.query<{ status: string; review_stage: string }>(
        "select status,review_stage from public.training_resources where id=$1",
        [resource],
      )
    ).rows[0],
  ).toEqual({ status: "draft", review_stage: "draft" });
  await deny(
    "update public.training_resources set status='published',review_stage='approved' where id=$1",
    [resource],
    /permission denied/,
  );
  await as("", "anon");
  expect(
    (
      await db.query("select id from public.training_resources where id=$1", [
        resource,
      ])
    ).rows,
  ).toEqual([]);
});
it("only Owner or Manager can approve submitted content, with versioned idempotency and audit", async () => {
  await as(coach);
  await db.query(
    "update public.training_resources set content=content||$2::jsonb where id=$1",
    [first, JSON.stringify({ cue: "New original cue" })],
  );
  await db.query(
    "select public.review_training_resource($1,'submit','Please review',4)",
    [first],
  );
  await deny(
    "select public.review_training_resource($1,'approve','',5)",
    [first],
    /Owner or Manager/,
  );
  await as(manager);
  await db.query(
    "select public.review_training_resource($1,'approve','Reviewed for technical test',5)",
    [first],
  );
  await db.query(
    "select public.review_training_resource($1,'approve','Reviewed for technical test',5)",
    [first],
  );
  const result = (
    await db.query<{ status: string; version: number; reviewed_by: string }>(
      "select status,version,reviewed_by from public.staff_training_resources() where id=$1",
      [first],
    )
  ).rows[0];
  expect(result).toEqual({
    status: "published",
    version: 6,
    reviewed_by: manager,
  });
  expect(
    (
      await db.query(
        "select * from public.training_review_audit where resource_id=$1 and stage='approved'",
        [first],
      )
    ).rows,
  ).toHaveLength(2);
});
it("requested changes stay private; editing approved content withdraws previous assignments", async () => {
  await save();
  await assign();
  await as(coach);
  await db.query(
    "update public.training_resources set content=content||$2::jsonb where id=$1",
    [first, JSON.stringify({ cue: "Revised cue" })],
  );
  await db.query("select public.review_training_resource($1,'submit','',4)", [
    first,
  ]);
  await as(owner);
  await deny(
    "select public.review_training_resource($1,'request_changes','',5)",
    [first],
    /Explain/,
  );
  await db.query(
    "select public.review_training_resource($1,'request_changes','Clarify the practice steps',5)",
    [first],
  );
  await as(parent);
  expect(
    (
      await db.query<{ items: unknown[] }>(
        "select coalesce(jsonb_agg(d),'[]') as items from public.athlete_training_plan($1) d",
        [profile],
      )
    ).rows[0].items,
  ).toEqual([]);
  await as(coach);
  expect(
    (
      await db.query<{ review_stage: string; review_notes: string }>(
        "select review_stage,review_notes from public.staff_training_resources() where id=$1",
        [first],
      )
    ).rows[0],
  ).toEqual({
    review_stage: "changes_requested",
    review_notes: "Clarify the practice steps",
  });
});
it("a coach cannot submit another coach's draft or read its review history", async () => {
  await as(otherCoach);
  await deny(
    "select public.review_training_resource($1,'submit','',3)",
    [first],
    /Staff access/,
  );
  expect(
    (
      await db.query(
        "select * from public.training_review_audit where resource_id=$1",
        [first],
      )
    ).rows,
  ).toEqual([]);
});
it("resume survives a new request, preserves its stable session and never creates completed history", async () => {
  await save();
  await assign();
  const result = await pause();
  expect(result.version).toBe(1);
  const next = await pause(parent, 1, 1);
  expect(next.current_index).toBe(1);
  expect(next.session_id).toBe(id(80));
  await as(parent);
  const loaded = (
    await db.query<{ result: { current_index: number } }>(
      "select public.load_practice_resume($1) as result",
      [profile],
    )
  ).rows[0].result;
  expect(loaded.current_index).toBe(1);
  expect(
    (
      await db.query(
        "select * from public.athlete_workouts where profile_id=$1",
        [profile],
      )
    ).rows,
  ).toEqual([]);
});
it("resume is isolated from another household, coaches and anonymous requests", async () => {
  await save();
  await assign();
  await pause();
  await as(otherParent);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
  await deny(
    "select public.save_practice_resume($1,$2,$3,$4,0,0,$5,1)",
    [profile, id(81), [second, first], [3, 3], workout],
    /unavailable/,
  );
  await as(coach);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
  await as("", "anon");
  await deny(
    "select public.load_practice_resume($1)",
    [profile],
    /permission denied/,
  );
});
it("resume retries are idempotent and conflicting device updates cannot silently overwrite practice", async () => {
  await save();
  await assign();
  await pause();
  expect((await pause(parent, 0)).version).toBe(1);
  await pause(parent, 1, 1);
  await deny(
    "select public.save_practice_resume($1,$2,$3,$4,0,1,$5,1)",
    [profile, id(80), [second, first], [3, 3], workout],
    /another device/,
  );
});
it("resume invalidates when instructions are revised or a workout is reassigned", async () => {
  await save();
  await assign();
  await pause();
  await as(coach);
  await db.query(
    "update public.training_resources set content=content||$2::jsonb where id=$1",
    [first, JSON.stringify({ cue: "Changed while paused" })],
  );
  await as(parent);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
});
it("finished practice atomically removes its resume and cannot be resumed or counted twice", async () => {
  await save();
  await assign();
  await pause();
  await as(parent);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(80),
    profile,
    [second, first],
    workout,
  ]);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(80),
    profile,
    [second, first],
    workout,
  ]);
  expect(
    (
      await db.query("select * from public.athlete_workouts where id=$1", [
        id(80),
      ])
    ).rows,
  ).toHaveLength(1);
  await deny(
    "select public.save_practice_resume($1,$2,$3,$4,0,0,$5,1)",
    [profile, id(80), [second, first], [3, 3], workout],
    /already recorded/,
  );
});
it("discard needs the matching saved version and leaves completed history untouched", async () => {
  await save();
  await assign();
  await pause();
  await pause(parent, 1, 1);
  await as(parent);
  await deny(
    "select public.discard_practice_resume($1,$2,1)",
    [profile, id(80)],
    /another device/,
  );
  await db.query("select public.discard_practice_resume($1,$2,2)", [
    profile,
    id(80),
  ]);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
});

it("reassigning the same template still invalidates the previous saved practice", async () => {
  await save();
  await assign();
  await pause();
  await assign(1);
  await as(parent);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
});
it("a changed family permission version invalidates saved practice without changing completed history", async () => {
  await save();
  await assign();
  await pause();
  await as(parent);
  await db.query("select public.set_athlete_permission($1,true,0)", [profile]);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
});
it("expired practice is removed rather than restored after its retention window", async () => {
  await save();
  await assign();
  await pause();
  await db.exec("reset role");
  await db.query(
    "update public.practice_resumes set expires_at=now()-interval '1 minute' where profile_id=$1",
    [profile],
  );
  await as(parent);
  expect(
    (
      await db.query<{ result: unknown }>(
        "select public.load_practice_resume($1) as result",
        [profile],
      )
    ).rows[0].result,
  ).toBeNull();
  await deny("select * from public.practice_resumes", [], /permission denied/);
});

it("internal approval notes cannot be read from public or assigned training responses", async () => {
  await save();
  await assign();
  await as(parent);
  const rows = (
    await db.query<{ review_notes: string; reviewed_by: unknown }>(
      "select review_notes,reviewed_by from public.athlete_training_plan($1)",
      [profile],
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(
    rows.every((row) => row.review_notes === "" && row.reviewed_by === null),
  ).toBe(true);
  await deny(
    "select review_notes from public.training_resources where id=$1",
    [first],
    /permission denied/,
  );
  await deny(
    "select * from public.staff_training_resources()",
    [],
    /Staff access/,
  );
  await deny(
    "select * from public.athlete_training_plan_internal_v8($1)",
    [profile],
    /permission denied/,
  );
  await as("", "anon");
  await deny(
    "select review_notes from public.training_resources",
    [],
    /permission denied/,
  );
  await as(coach);
  expect(
    (
      await db.query<{ review_notes: string }>(
        "select review_notes from public.staff_training_resources() where id=$1",
        [first],
      )
    ).rows[0].review_notes,
  ).toContain("Fictional technical test release");
});
