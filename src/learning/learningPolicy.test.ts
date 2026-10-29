import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { EXAMPLE_QUIZ_CSV, parseQuizCsv } from "./quizImport";
let db: PGlite;
const id = (n: number) =>
  `91000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  owner,
  manager,
  coach,
  otherCoach,
  parent,
  otherParent,
  profile,
  sibling,
  otherProfile,
  quiz,
  quizVersion,
  plan,
  week,
  enrollment,
  attempt,
  lesson,
] = [1, 2, 3, 4, 5, 6, 10, 11, 12, 20, 21, 30, 31, 40, 50, 60].map(id);
const payload = parseQuizCsv(EXAMPLE_QUIZ_CSV).quiz!;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  const files = [
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
    "015-staff-client-service-dashboard.sql",
    "016-delivery-monitoring-and-inbox.sql",
    "017-staff-operational-notifications.sql",
    "018-public-interest-and-shared-inbox.sql",
    "019-weekly-learning.sql",
    "020-learning-media-retention.sql",
    "021-learning-service-workflows.sql",
    "022-package-week-completeness.sql",
    "024-weekly-notification-overrides.sql",
  ];
  for (const file of files)
    await db.exec(
      readFileSync(new URL("../../backend/" + file, import.meta.url), "utf8"),
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
      [id(n), `learning-${n}@example.test`],
    );
    await db.query(
      "insert into public.account_roles(user_id,role) values($1,$2)",
      [id(n), role],
    );
  }
  await db.exec(`insert into public.member_accounts(user_id,account_type,adult_confirmed_at,privacy_acknowledged_at) values('${parent}','parent',now(),now()),('${otherParent}','parent',now(),now());
 insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal) values('${profile}','${parent}','Fictional learner','18+','Quarterback','New to the game','Footwork'),('${sibling}','${parent}','Fictional sibling','18+','Quarterback','New to the game','Footwork'),('${otherProfile}','${otherParent}','Other household','18+','Quarterback','New to the game','Footwork');
 insert into public.athlete_service_coaches(profile_id,coach_id) values('${profile}','${coach}');update public.learning_settings set enabled=true;`);
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = owner, role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function r(sql: string, args: unknown[] = []) {
  return (await db.query<{ r: unknown }>(sql, args)).rows[0]?.r;
}
async function blocked(
  sql: string,
  args: unknown[] = [],
  pattern = /permission|scope|access|not assigned|unavailable|only|invalid|choose|changed|grading|Submitted answers cannot be edited/i,
) {
  await db.exec("savepoint forbidden");
  await expect(db.query(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint forbidden");
}
async function setup() {
  await as();
  await db.query("select public.learning_import_quiz($1,$2,$3,$4)", [
    quizVersion,
    quiz,
    "Fictional import",
    payload,
  ]);
  await db.query(
    "select public.learning_create_plan($1,'Fictional weekly plan',2,'{private_test}','{}','{}')",
    [plan],
  );
  await db.query("select public.learning_save_week($1,$2,1,'Week 1','{}',$3)", [
    week,
    plan,
    [quizVersion],
  ]);
  await as(manager);
  await db.query("select public.learning_approve_week($1)", [week]);
  await as();
  await db.query(
    "select public.learning_set_access($1,'private_test',now()-interval '1 day',now()+interval '1 year','Synthetic acceptance test',false)",
    [profile],
  );
  await db.query("select public.learning_enroll($1,$2,$3,true)", [
    enrollment,
    profile,
    plan,
  ]);
}
async function release() {
  await setup();
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true;update public.learning_enrollments set next_release_at=now()-interval '1 minute'",
  );
  await db.query("select public.learning_tick(now(),false)");
  return (
    await db.query<{ id: string }>(
      "select id from public.learning_releases where enrollment_id=$1",
      [enrollment],
    )
  ).rows[0].id;
}
it("requires feature activation, rejects anonymous raw keys and learner/staff privilege escalation", async () => {
  await as(parent);
  await blocked("select public.learning_import_quiz($1,$2,$3,$4)", [
    quizVersion,
    quiz,
    "Not allowed",
    payload,
  ]);
  await blocked("select * from public.learning_quiz_keys");
  await as("", "anon");
  await blocked("select public.learning_catalog()");
  await as(owner);
  await blocked("select public.learning_tick(now(),false)");
});
it("imports atomically and idempotently, server rejects forged keys/extra learner fields", async () => {
  await as();
  expect(
    await r("select public.learning_import_quiz($1,$2,$3,$4) r", [
      quizVersion,
      quiz,
      "Example",
      payload,
    ]),
  ).toBe(quizVersion);
  expect(
    await r("select public.learning_import_quiz($1,$2,$3,$4) r", [
      quizVersion,
      quiz,
      "Example",
      payload,
    ]),
  ).toBe(quizVersion);
  const bad = structuredClone(payload);
  bad.keys[0].correct = 8;
  await blocked("select public.learning_import_quiz($1,$2,$3,$4)", [
    id(22),
    quiz,
    "Invalid",
    bad,
  ]);
  const hidden = structuredClone(payload);
  Object.assign(hidden.questions[0], { correct: 0 });
  await blocked("select public.learning_import_quiz($1,$2,$3,$4)", [
    id(23),
    quiz,
    "Hidden key",
    hidden,
  ]);
});
it("enrolls once per athlete; sibling is independent and coaches cannot grant eligibility", async () => {
  await setup();
  await as(coach);
  await blocked(
    "select public.learning_set_access($1,'private_test',now(),now()+interval '1 year','Not authorized',false)",
    [sibling],
  );
  await as();
  await blocked("select public.learning_enroll($1,$2,$3,true)", [
    id(41),
    sibling,
    plan,
  ]);
  expect(
    await r("select public.learning_enroll($1,$2,$3,true) r", [
      enrollment,
      profile,
      plan,
    ]),
  ).toBe(enrollment);
});
it("Sunday schedule is DST-aware in PostgreSQL", async () => {
  await as("", "postgres");
  expect(
    await r(
      "select to_char(public.learning_next_sunday('2026-03-07 12:00Z'),'YYYY-MM-DD HH24:MI') r",
    ),
  ).toBe("2026-03-08 06:00");
  expect(
    await r(
      "select to_char(public.learning_next_sunday('2026-03-08 06:00Z'),'YYYY-MM-DD HH24:MI') r",
    ),
  ).toBe("2026-03-15 05:00");
  expect(
    await r(
      "select to_char(public.learning_next_sunday('2026-11-01 05:00Z'),'YYYY-MM-DD HH24:MI') r",
    ),
  ).toBe("2026-11-08 06:00");
});
it("dry-run does not release, repeated ticks never duplicate and missing week alerts stay staff-only", async () => {
  await setup();
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true;update public.learning_enrollments set next_release_at=now()-interval '1 minute'",
  );
  expect(await r("select public.learning_tick(now(),true) r")).toMatchObject({
    releases: 1,
    dry_run: true,
  });
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(0);
  await db.query("select public.learning_tick(now(),false)");
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='no_content'",
    ),
  ).toBe(1);
  await as(parent);
  expect(await r("select public.learning_inbox() r")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ category: "content_ready" }),
    ]),
  );
  expect(
    JSON.stringify(await r("select public.learning_inbox() r")),
  ).not.toContain("no_content");
  await as(coach);
  expect(JSON.stringify(await r("select public.learning_inbox() r"))).toContain(
    "no_content",
  );
  await as(otherCoach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
});
it("learner receives no keys; save/resume/server score/written grading preserve immutable attempts", async () => {
  const rid = await release();
  await as(parent);
  const data = await r("select public.learning_athlete($1) r", [profile]);
  expect(JSON.stringify(data)).not.toContain("correct");
  expect(JSON.stringify(data)).not.toContain("explanation");
  let saved = await r(
    "select public.learning_save_attempt($1,$2,$3,$4,false,0) r",
    [attempt, rid, quizVersion, { sample_1: 0 }],
  );
  expect(saved).toMatchObject({ state: "draft", version: 1 });
  const answers = {
    sample_1: 0,
    sample_2: 0,
    sample_3: "Fictional written response",
  };
  saved = await r("select public.learning_save_attempt($1,$2,$3,$4,true,1) r", [
    attempt,
    rid,
    quizVersion,
    answers,
  ]);
  expect(saved).toMatchObject({
    state: "needs_grading",
    objective_points: 2,
    version: 2,
  });
  expect(
    await r("select public.learning_save_attempt($1,$2,$3,$4,true,1) r", [
      attempt,
      rid,
      quizVersion,
      answers,
    ]),
  ).toEqual(saved);
  await blocked("select public.learning_save_attempt($1,$2,$3,$4,true,2)", [
    attempt,
    rid,
    quizVersion,
    { ...answers, sample_1: 1 },
  ]);
  await blocked("select public.learning_grade_written($1,$2,$3,0)", [
    attempt,
    { sample_3: 2 },
    "Not staff",
  ]);
  await as(otherCoach);
  await blocked("select public.learning_grade_written($1,$2,$3,0)", [
    attempt,
    { sample_3: 2 },
    "Wrong coach",
  ]);
  await as(coach);
  expect(
    await r("select public.learning_grade_written($1,$2,$3,0) r", [
      attempt,
      { sample_3: 1.5 },
      "Clear example response",
    ]),
  ).toBe(1);
  await as(parent);
  expect(
    JSON.stringify(await r("select public.learning_athlete($1) r", [profile])),
  ).toContain("Clear example response");
});
it("denies other households, wrong sibling release, revoked access and assignment changes", async () => {
  const rid = await release();
  await as(otherParent);
  await blocked("select public.learning_athlete($1)", [profile]);
  await blocked("select public.learning_save_attempt($1,$2,$3,$4,false,0)", [
    attempt,
    rid,
    quizVersion,
    {},
  ]);
  await as(coach);
  await db.exec("reset role");
  await db.query(
    "update public.athlete_service_coaches set coach_id=$1 where profile_id=$2",
    [otherCoach, profile],
  );
  await as(coach);
  await blocked("select public.learning_athlete($1)", [profile]);
  await as("", "postgres");
  await db.query(
    "update public.learning_access set revoked_at=now() where profile_id=$1",
    [profile],
  );
  await as(parent);
  expect(
    JSON.stringify(await r("select public.learning_athlete($1) r", [profile])),
  ).toContain('"questions":[]');
  await blocked("select public.learning_save_attempt($1,$2,$3,$4,false,0)", [
    attempt,
    rid,
    quizVersion,
    {},
  ]);
});
it("pause/resume/repeat retain history and reject stale repeated control actions", async () => {
  const rid = await release();
  await as();
  expect(
    await r("select public.learning_control($1,'pause',2,null) r", [
      enrollment,
    ]),
  ).toBe(3);
  await blocked("select public.learning_control($1,'pause',2,null)", [
    enrollment,
  ]);
  expect(
    await r("select public.learning_control($1,'resume',3,null) r", [
      enrollment,
    ]),
  ).toBe(4);
  expect(
    await r("select public.learning_control($1,'repeat',4,$2) r", [
      enrollment,
      rid,
    ]),
  ).toBe(5);
  await as("", "postgres");
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(2);
});
it("releases only approved complete unchanged lessons and retains their original media", async () => {
  await setup();
  await as("", "postgres");
  const path = `${coach}/${lesson}/${id(61)}.txt`;
  await db.query(
    "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status,review_stage) values($1,$2,$3,$4,'text/plain','original.txt','published','approved')",
    [
      lesson,
      coach,
      {
        sport: "football",
        title: "Fictional lesson",
        skill: "Footwork",
        ages: ["18+"],
        positions: [],
        levels: ["New to the game"],
        minutes: 3,
        equipment: "Markers",
        lesson: "Pending coaching review example",
        steps: ["Walk"],
        cue: "Controlled",
        kind: "movement",
      },
      path,
    ],
  );
  await db.query(
    "update public.training_resources set review_stage='approved',status='published' where id=$1",
    [lesson],
  );
  await as();
  await db.query(
    "select public.learning_save_week($1,$2,2,'Media week',$3,'{}')",
    [id(32), plan, [lesson]],
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [id(32)],
    /uploads|complete|approved/i,
  );
  await as("", "postgres");
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'training-media\',$1,\'{"size":100,"mimetype":"text/plain"}\')',
    [path],
  );
  await as();
  await db.query("select public.learning_approve_week($1)", [id(32)]);
  await as("", "postgres");
  await db.query(
    "insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at) values($1,1,2,$2,now())",
    [enrollment, id(32)],
  );
  await as(parent);
  expect(
    (await db.query("select name from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(1);
  await as(otherParent);
  expect(
    (await db.query("select name from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(0);
  await as("", "postgres");
  await db.query(
    "update public.training_resources set asset_path=$1,version=version+1 where id=$2",
    [`${coach}/${lesson}/${id(62)}.txt`, lesson],
  );
  await as(parent);
  expect(
    (await db.query("select name from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(1);
  await as();
  await db.query("delete from storage.objects where name=$1", [path]);
  await as("", "postgres");
  expect(
    (await db.query("select name from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(1);
  await as();
  await db.query("select public.learning_retract_week($1)", [id(32)]);
  await as(parent);
  expect(
    (await db.query("select name from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(0);
});
it("group enrollment is atomic and idempotent; group scope does not leak another coach roster", async () => {
  await setup();
  await as();
  await db.query(
    "select public.learning_save_cohort($1,'Fictional group',$2)",
    [id(70), [profile, sibling]],
  );
  await blocked(
    "select public.learning_enroll_cohort($1,$2,$3)",
    [id(70), plan, id(71)],
    /current enrollment|eligibility/i,
  );
  await db.query("select public.learning_control($1,'end',1,null)", [
    enrollment,
  ]);
  await db.query(
    "select public.learning_set_access($1,'private_test',now()-interval '1 day',now()+interval '1 year','Synthetic group test',false)",
    [sibling],
  );
  expect(
    await r("select public.learning_enroll_cohort($1,$2,$3) r", [
      id(70),
      plan,
      id(71),
    ]),
  ).toBe(2);
  expect(
    await r("select public.learning_enroll_cohort($1,$2,$3) r", [
      id(70),
      plan,
      id(71),
    ]),
  ).toBe(2);
  await as(coach);
  const c = await r("select public.learning_catalog() r");
  expect(JSON.stringify(c)).toContain(profile);
  expect(JSON.stringify(c)).not.toContain(sibling);
  await as(otherCoach);
  expect(
    JSON.stringify(await r("select public.learning_catalog() r")),
  ).not.toContain(id(70));
});
it("Friday reminder is deduplicated, skipped for completed work, and still works on a final released week", async () => {
  const rid = await release();
  await as("", "postgres");
  await db.query(
    "update public.learning_releases set available_at='2026-10-25 05:00Z' where id=$1",
    [rid],
  );
  await db.query(
    "update public.learning_enrollments set state='finished',next_release_at='2026-11-01 05:00Z' where id=$1",
    [enrollment],
  );
  await db.query("select public.learning_tick('2026-10-30 21:59Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(0);
  await db.query("select public.learning_tick('2026-10-30 22:01Z',false)");
  await db.query("select public.learning_tick('2026-10-30 22:02Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(1);
  await db.query(
    "insert into public.learning_quiz_attempts(id,release_id,quiz_version_id,actor_id,answers,state,submitted_at) values($1,$2,$3,$4,'{}','needs_grading',now())",
    [attempt, rid, quizVersion, parent],
  );
  await db.query("select public.learning_tick('2026-10-30 22:03Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete' and resolved_at is null",
    ),
  ).toBe(0);
});
it("no historical reminder flood; unapproved future draft does not count as ready capacity", async () => {
  await setup();
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true;update public.learning_enrollments set next_release_at='2026-09-01 05:00Z'",
  );
  await db.query("select public.learning_tick('2026-10-30 22:01Z',false)");
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(0);
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='no_content'",
    ),
  ).toBe(1);
  await as();
  await db.query(
    "select public.learning_save_week($1,$2,2,'Not approved','{}',$3)",
    [id(32), plan, [quizVersion]],
  );
  await as("", "postgres");
  await db.query("select public.learning_tick('2026-10-30 22:02Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='no_content' and resolved_at is null",
    ),
  ).toBe(1);
});
it("youth and closing households stay blocked even before a live rollout", async () => {
  await setup();
  await as("", "postgres");
  await db.query(
    "insert into public.family_minor_profiles(profile_id) values($1)",
    [profile],
  );
  await as(parent);
  await blocked("select public.learning_athlete($1)", [profile]);
});
it("customer erasure removes owned learning records while preserving reusable staff content", async () => {
  const rid = await release();
  await as(parent);
  await db.query("select public.learning_save_attempt($1,$2,$3,$4,false,0)", [
    attempt,
    rid,
    quizVersion,
    { sample_1: 0 },
  ]);
  await as("", "postgres");
  await db.query("delete from public.member_accounts where user_id=$1", [
    parent,
  ]);
  expect(
    await r("select count(*)::integer r from public.learning_enrollments"),
  ).toBe(0);
  expect(
    await r("select count(*)::integer r from public.learning_quiz_attempts"),
  ).toBe(0);
  expect(
    await r("select count(*)::integer r from public.learning_quizzes"),
  ).toBe(1);
});
it("versioned templates never overwrite released questions, and future overrides are athlete-specific", async () => {
  const rid = await release();
  await as();
  const changed = structuredClone(payload);
  changed.questions[0].question = "A new future question";
  await db.query("select public.learning_import_quiz($1,$2,$3,$4)", [
    id(22),
    quiz,
    "Fictional import",
    changed,
  ]);
  await db.query(
    "select public.learning_save_week($1,$2,2,'Future version','{}',$3)",
    [id(32), plan, [id(22)]],
  );
  await db.query("select public.learning_approve_week($1)", [id(32)]);
  await db.query("select public.learning_set_override($1,2,$2)", [
    enrollment,
    id(32),
  ]);
  await as(parent);
  const data = await r("select public.learning_athlete($1) r", [profile]);
  expect(JSON.stringify(data)).not.toContain("A new future question");
  await blocked("select public.learning_save_attempt($1,$2,$3,$4,false,0)", [
    attempt,
    rid,
    id(22),
    {},
  ]);
});
it("only Owners change reminder rules; configured Friday time and low-content resolution are applied", async () => {
  await setup();
  await as(manager);
  await blocked("select public.learning_configure_rules('16:30',3)");
  await as();
  await db.query("select public.learning_configure_rules('16:30',3)");
  expect(await r("select public.learning_catalog() r")).toMatchObject({
    rules: { friday_time: "16:30:00", low_ready_weeks: 3 },
  });
});
it("configured Friday clock is enforced at the boundary and paused athletes receive no reminder", async () => {
  const rid = await release();
  await as();
  await db.query("select public.learning_configure_rules('16:30',2)");
  await as("", "postgres");
  await db.query(
    "update public.learning_releases set available_at='2026-11-01 05:00Z' where id=$1",
    [rid],
  );
  await db.query(
    "update public.learning_enrollments set next_release_at='2026-11-08 06:00Z' where id=$1",
    [enrollment],
  );
  const reminders = () =>
    r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    );
  await db.query("select public.learning_tick('2026-11-06 22:29:59Z',false)");
  expect(await reminders()).toBe(0);
  const version = await r(
    "select version r from public.learning_enrollments where id=$1",
    [enrollment],
  );
  await as();
  await db.query("select public.learning_control($1,'pause',$2)", [
    enrollment,
    version,
  ]);
  await as("", "postgres");
  await db.query("select public.learning_tick('2026-11-06 22:30Z',false)");
  expect(await reminders()).toBe(0);
  // Synthetic state restoration isolates the clock check from resume's deliberate
  // next-Sunday policy; no live scheduler or enrollment is changed.
  await db.query(
    "update public.learning_enrollments set state='active' where id=$1",
    [enrollment],
  );
  await db.query("select public.learning_tick('2026-11-06 22:30Z',false)");
  await db.query("select public.learning_tick('2026-11-06 22:31Z',false)");
  expect(await reminders()).toBe(1);
});
it("capacity warnings deduplicate, resolve when approved weeks arrive and reopen without stale read state", async () => {
  await setup();
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true;update public.learning_enrollments set next_release_at=now()+interval '1 day'",
  );
  await db.query("select public.learning_tick(now(),false)");
  await db.query("select public.learning_tick(now(),false)");
  const warning = await r(
    "select id::text r from public.learning_notices where category='low_content' and resolved_at is null",
  );
  expect(typeof warning).toBe("string");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='low_content'",
    ),
  ).toBe(1);
  await as(coach);
  await db.query("select public.learning_read_notice($1)", [warning]);
  await as();
  await db.query(
    "select public.learning_save_week($1,$2,2,'Approved second week','{}',$3)",
    [id(32), plan, [quizVersion]],
  );
  await db.query("select public.learning_approve_week($1)", [id(32)]);
  await as("", "postgres");
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category in ('low_content','no_content') and resolved_at is null",
    ),
  ).toBe(0);
  await as();
  await db.query("select public.learning_retract_week($1)", [id(32)]);
  await as("", "postgres");
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r(
      "select id::text r from public.learning_notices where category='low_content' and resolved_at is null",
    ),
  ).toBe(warning);
  expect(
    await r(
      "select count(*)::integer r from public.learning_notice_reads where notice_id=$1",
      [warning],
    ),
  ).toBe(0);
  await as();
  await db.query("select public.learning_retract_week($1)", [week]);
  await as("", "postgres");
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='low_content' and resolved_at is null",
    ),
  ).toBe(0);
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='no_content' and resolved_at is null",
    ),
  ).toBe(1);
  await as(parent);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
  await as(otherCoach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
  await as("", "postgres");
  const version = await r(
    "select version r from public.learning_enrollments where id=$1",
    [enrollment],
  );
  await as();
  await db.query("select public.learning_control($1,'pause',$2)", [
    enrollment,
    version,
  ]);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
});
it("linked athletes respect independent-recording permission and guardian practice approval", async () => {
  const rid = await release();
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
  await db.query(
    "insert into public.family_athlete_controls(profile_id,self_recording_allowed) values($1,false)",
    [profile],
  );
  await as(linked);
  await blocked(
    "select public.learning_save_attempt($1,$2,$3,$4,false,0)",
    [attempt, rid, quizVersion, {}],
    /parent has paused/i,
  );
  await as("", "postgres");
  await db.query(
    "update public.family_athlete_controls set self_recording_allowed=true where profile_id=$1",
    [profile],
  );
  await db.query(
    "update public.learning_week_versions set resources=$1 where id=$2",
    [[{ id: lesson }], week],
  );
  await as(linked);
  await db.query("select public.learning_complete($1,$2)", [rid, lesson]);
  await as("", "postgres");
  expect(
    await r(
      "select status r from public.learning_completion where release_id=$1",
      [rid],
    ),
  ).toBe("pending_parent");
  await as(coach);
  await blocked(
    "select public.learning_review_completion($1,$2,'approved',1)",
    [rid, lesson],
    /only.*parent/i,
  );
  await as(parent);
  await db.query(
    "select public.learning_review_completion($1,$2,'needs_repeat',1)",
    [rid, lesson],
  );
  await as(linked);
  await db.query("select public.learning_complete($1,$2)", [rid, lesson]);
  await as(parent);
  await db.query(
    "select public.learning_review_completion($1,$2,'approved',3)",
    [rid, lesson],
  );
  await blocked(
    "select public.learning_review_completion($1,$2,'approved',3)",
    [rid, lesson],
    /changed/i,
  );
});
it("group gradebook uses server scores, includes waiting work, and scopes each staff role", async () => {
  const rid = await release();
  await as(parent);
  await db.query("select public.learning_save_attempt($1,$2,$3,$4,true,0)", [
    attempt,
    rid,
    quizVersion,
    { sample_1: 0, sample_2: 0, sample_3: "Fictional response" },
  ]);
  await as(coach);
  await db.query("select public.learning_grade_written($1,$2,$3,0)", [
    attempt,
    { sample_3: 1.5 },
    "Fictional feedback",
  ]);
  await as();
  await db.query(
    "select public.learning_save_cohort($1,'Gradebook scope',$2)",
    [id(70), [profile, sibling]],
  );
  const rows = (await r("select public.learning_group_results($1) r", [
    id(70),
  ])) as { profile_id: string; quiz_attempts: unknown[] }[];
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.profile_id === profile)?.quiz_attempts).toEqual(
    [
      expect.objectContaining({
        state: "graded",
        objective_points: 2,
        written_points: 1.5,
        total_points: 4,
      }),
    ],
  );
  await as(manager);
  expect(
    await r("select public.learning_group_results($1) r", [id(70)]),
  ).toHaveLength(2);
  await as(coach);
  expect(
    await r("select public.learning_group_results($1) r", [id(70)]),
  ).toEqual([expect.objectContaining({ profile_id: profile })]);
  await as(otherCoach);
  expect(
    await r("select public.learning_group_results($1) r", [id(70)]),
  ).toEqual([]);
  await as(parent);
  await blocked("select public.learning_group_results($1)", [id(70)]);
});
it("one failed enrollment rolls back its own release without blocking others or overstating successes", async () => {
  await setup();
  const brokenPlan = id(80),
    firstWeek = id(81),
    brokenEnrollment = id(83);
  await as();
  await db.query(
    "select public.learning_create_plan($1,'Isolated failure plan',2,'{private_test}','{}','{}')",
    [brokenPlan],
  );
  await db.query(
    "select public.learning_save_week($1,$2,1,'Ready first week','{}',$3)",
    [firstWeek, brokenPlan, [quizVersion]],
  );
  await db.query("select public.learning_approve_week($1)", [firstWeek]);
  await db.query(
    "select public.learning_set_access($1,'private_test',now()-interval '1 day',now()+interval '1 year','Synthetic failure test',false)",
    [sibling],
  );
  await db.query("select public.learning_enroll($1,$2,$3,true)", [
    brokenEnrollment,
    sibling,
    brokenPlan,
  ]);
  await as("", "postgres");
  // Force a downstream insert error to exercise per-athlete transaction rollback.
  await db.exec(`create function public.test_learning_release_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic release failure';end$$;
  create trigger synthetic_release_failure before insert on public.learning_releases for each row when (new.enrollment_id='${brokenEnrollment}') execute function public.test_learning_release_failure();`);
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true;update public.learning_enrollments set next_release_at=now()-interval '1 minute'",
  );
  const outcome = await r("select public.learning_tick(now(),false) r");
  expect(outcome).toMatchObject({ releases: 1, failed_enrollments: 1 });
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  expect(
    await r(
      "select count(*)::integer r from public.learning_audit where action='release_tick_failed'",
    ),
  ).toBe(1);
});
it("Friday notices follow current work, parent permission and active access rather than becoming stale nags", async () => {
  const rid = await release();
  const linked = id(7);
  await as("", "postgres");
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-notice-linked@example.test',now())",
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
  await db.query(
    "insert into public.family_athlete_controls(profile_id,self_recording_allowed) values($1,false)",
    [profile],
  );
  await db.query(
    "insert into public.learning_notices(event_key,profile_id,release_id,category,staff_only) values('synthetic-friday',$1,$2,'friday_incomplete',false)",
    [profile, rid],
  );
  await as(parent);
  expect(JSON.stringify(await r("select public.learning_inbox() r"))).toContain(
    "friday_incomplete",
  );
  await as(linked);
  expect(
    JSON.stringify(await r("select public.learning_inbox() r")),
  ).not.toContain("friday_incomplete");
  await as("", "postgres");
  await db.query(
    "update public.family_athlete_controls set self_recording_allowed=true where profile_id=$1",
    [profile],
  );
  await as(linked);
  expect(JSON.stringify(await r("select public.learning_inbox() r"))).toContain(
    "friday_incomplete",
  );
  await as("", "postgres");
  await db.query(
    "insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at) values($1,2,1,$2,now())",
    [enrollment, week],
  );
  await as(parent);
  expect(
    JSON.stringify(await r("select public.learning_inbox() r")),
  ).not.toContain("friday_incomplete");
  await as("", "postgres");
  await db.query(
    "update public.learning_access set revoked_at=now() where profile_id=$1",
    [profile],
  );
  await as(parent);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
  await as(coach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
});
it("weekly service summary replaces legacy workout assumptions without widening staff scope", async () => {
  const rid = await release();
  await as();
  const first = await r("select public.staff_athlete_service($1) r", [profile]);
  expect(first).toMatchObject({
    workout_id: null,
    learning: {
      status: "needs_content",
      title: "Fictional weekly plan",
      current_week: 1,
    },
    next_action: "Prepare the next week",
  });
  await db.query(
    "select public.learning_save_week($1,$2,2,'Ready next week','{}',$3)",
    [id(32), plan, [quizVersion]],
  );
  await db.query("select public.learning_approve_week($1)", [id(32)]);
  expect(
    await r("select public.staff_athlete_service($1) r", [profile]),
  ).toMatchObject({
    learning: { status: "ready", ready_weeks: 1, current_release_id: rid },
    next_action: "View weekly training",
  });
  await as(manager);
  expect(
    await r("select public.staff_athlete_service($1) r", [profile]),
  ).toMatchObject({ learning: { status: "ready" } });
  await as(coach);
  expect(
    await r("select public.staff_athlete_service($1) r", [profile]),
  ).toMatchObject({ learning: { status: "ready" } });
  await as(otherCoach);
  await blocked(
    "select public.staff_athlete_service($1)",
    [profile],
    /outside your service roster/i,
  );
  await as(parent);
  await blocked("select public.staff_learning_roster_page()");
});
it("server pagination stays bounded, deterministic, searchable and scoped across many athletes", async () => {
  await as("", "postgres");
  await db.query(
    "insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal) select ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,'Fictional paging athlete '||n,'18+','Quarterback','New to the game','Footwork' from generate_series(1001,1150) n",
    [parent],
  );
  await db.query(
    "insert into public.athlete_service_coaches(profile_id,coach_id) select id,case when right(id::text,1)::integer%2=0 then $1::uuid else $2::uuid end from public.player_profiles where nickname like 'Fictional paging%'",
    [coach, otherCoach],
  );
  await as();
  let cursor: unknown = null;
  const found: string[] = [];
  for (let page = 0; page < 12; page++) {
    const result = (await r(
      "select public.staff_learning_roster_page('','all','','','',$1,17) r",
      [cursor],
    )) as {
      rows: { athlete_id: string }[];
      page: { next_cursor: unknown; total: number };
    };
    expect(result.rows.length).toBeLessThanOrEqual(17);
    expect(result.page.total).toBe(153);
    found.push(...result.rows.map((row) => row.athlete_id));
    cursor = result.page.next_cursor;
    if (!cursor) break;
  }
  expect(found).toHaveLength(153);
  expect(new Set(found).size).toBe(153);
  const searched = (await r(
    "select public.staff_learning_roster_page('PAGING 1001','all','','','',null,25) r",
  )) as { rows: { athlete_id: string }[] };
  expect(searched.rows).toHaveLength(1);
  expect(searched.rows[0].athlete_id).toBe(id(1001));
  await as(coach);
  const scoped = (await r("select public.staff_learning_roster_page() r")) as {
    page: { total: number };
    rows: { athlete_id: string }[];
  };
  expect(scoped.page.total).toBe(76);
  expect(
    scoped.rows.every(
      (row) => row.athlete_id !== sibling && row.athlete_id !== otherProfile,
    ),
  ).toBe(true);
  await blocked(
    "select public.staff_learning_roster_page('','all','','','',null,null)",
    [],
    /valid roster|page size/i,
  );
  await as();
  await db.query("select public.assign_athlete_service_coach($1,$2,1)", [
    profile,
    otherCoach,
  ]);
  await as(coach);
  expect(
    (
      (await r("select public.staff_learning_roster_page() r")) as {
        page: { total: number };
      }
    ).page.total,
  ).toBe(75);
}, 30000);
it("paged search normalizes accents and includes pending-profile clients only for administrators", async () => {
  await as("", "postgres");
  await db.query(
    "update public.player_profiles set nickname='Fictional José' where id=$1",
    [profile],
  );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-pending@example.test',now())",
    [id(7)],
  );
  await db.query(
    "insert into public.account_roles(user_id,role) values($1,'parent')",
    [id(7)],
  );
  await db.query(
    "insert into public.member_accounts(user_id,account_type,adult_confirmed_at,privacy_acknowledged_at) values($1,'parent',now(),now())",
    [id(7)],
  );
  await as();
  expect(
    (
      (await r("select public.staff_learning_roster_page('jose') r")) as {
        rows: unknown[];
      }
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      (await r(
        "select public.staff_learning_roster_page('fictional-pending') r",
      )) as { rows: { athlete_id: unknown }[] }
    ).rows,
  ).toEqual([expect.objectContaining({ athlete_id: null })]);
  await as(coach);
  expect(
    (
      (await r(
        "select public.staff_learning_roster_page('fictional-pending') r",
      )) as { rows: unknown[] }
    ).rows,
  ).toEqual([]);
});
it("quiz authors can review later revisions without exposing any keys to another coach or household", async () => {
  await as(coach);
  await db.query("select public.learning_import_quiz($1,$2,$3,$4)", [
    quizVersion,
    quiz,
    "Fictional authored quiz",
    payload,
  ]);
  await as();
  await db.query("select public.learning_import_quiz($1,$2,$3,$4)", [
    id(22),
    quiz,
    "Fictional authored quiz",
    payload,
  ]);
  await as(coach);
  expect(
    ((await r("select public.learning_catalog() r")) as { quizzes: unknown[] })
      .quizzes,
  ).toHaveLength(2);
  await as(otherCoach);
  expect(
    ((await r("select public.learning_catalog() r")) as { quizzes: unknown[] })
      .quizzes,
  ).toEqual([]);
  await as(parent);
  await blocked("select public.learning_catalog()");
});
it("a growing group enrolls only new members and keeps existing progress, pauses and grades", async () => {
  const rid = await release();
  await as();
  await db.query("select public.learning_save_cohort($1,'Growing cohort',$2)", [
    id(70),
    [profile, sibling],
  ]);
  let preview = await r(
    "select public.learning_group_enrollment_preview($1,$2) r",
    [id(70), plan],
  );
  expect(preview).toMatchObject({
    new_count: 0,
    kept_count: 1,
    blocked_count: 1,
  });
  await db.query(
    "select public.learning_set_access($1,'private_test',now()-interval '1 day',now()+interval '1 year','Synthetic newcomer',false)",
    [sibling],
  );
  preview = await r(
    "select public.learning_group_enrollment_preview($1,$2) r",
    [id(70), plan],
  );
  expect(preview).toMatchObject({
    new_count: 1,
    kept_count: 1,
    blocked_count: 0,
  });
  expect(
    await r("select public.learning_enroll_cohort($1,$2,$3) r", [
      id(70),
      plan,
      id(71),
    ]),
  ).toBe(1);
  expect(
    await r("select public.learning_enroll_cohort($1,$2,$3) r", [
      id(70),
      plan,
      id(71),
    ]),
  ).toBe(1);
  await as("", "postgres");
  expect(
    await r(
      "select count(*)::integer r from public.learning_releases where enrollment_id=$1",
      [enrollment],
    ),
  ).toBe(1);
  expect(
    await r(
      "select id r from public.learning_releases where enrollment_id=$1",
      [enrollment],
    ),
  ).toBe(rid);
  expect(
    await r("select next_week r from public.learning_enrollments where id=$1", [
      enrollment,
    ]),
  ).toBe(2);
  await as(coach);
  await blocked("select public.learning_group_enrollment_preview($1,$2)", [
    id(70),
    plan,
  ]);
});
it("notices carry only scoped athlete context and point to the actual next release", async () => {
  await release();
  await as(coach);
  const rows = (await r("select public.learning_inbox() r")) as {
    athlete_name: string;
    next_due_at: string;
  }[];
  expect(rows).toEqual([
    expect.objectContaining({
      athlete_name: "Fictional learner",
      category: "no_content",
      next_due_at: expect.any(String),
    }),
  ]);
  await as(otherCoach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
});
it("rollback flags stop learning and scheduler access without erasing progress or changing legacy service scope", async () => {
  const rid = await release();
  await as(parent);
  await db.query("select public.learning_save_attempt($1,$2,$3,$4,true,0)", [
    attempt,
    rid,
    quizVersion,
    { sample_1: 0, sample_2: 0, sample_3: "Synthetic recovery response" },
  ]);
  await as(coach);
  await db.query("select public.learning_grade_written($1,$2,$3,0)", [
    attempt,
    { sample_3: 2 },
    "Synthetic retained feedback",
  ]);
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set enabled=false,scheduler_enabled=false,notices_enabled=false",
  );
  expect(await r("select public.learning_tick(now(),false) r")).toMatchObject({
    disabled: true,
  });
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  expect(
    await r("select count(*)::integer r from public.learning_quiz_attempts"),
  ).toBe(1);
  expect(
    await r("select count(*)::integer r from public.learning_quiz_grades"),
  ).toBe(1);
  await as(parent);
  await blocked("select public.learning_athlete($1)", [profile]);
  expect(await r("select public.can_view_athlete($1) r", [profile])).toBe(true);
  await as();
  const legacy = (await r("select public.staff_athlete_service($1) r", [
    profile,
  ])) as Record<string, unknown>;
  expect(legacy.athlete_id).toBe(profile);
  expect(legacy).not.toHaveProperty("learning");
});

async function officialWeek(packages = ["foundation"]) {
  const rids = Array.from({ length: 6 }, (_, n) => id(4100 + n));
  const qids = [id(4200), id(4201)];
  const p = id(4400),
    w = id(4500);
  const extended = packages.some(
    (p) => p === "position-development" || p === "elite-coaching",
  );
  const movement = extended || packages.includes("fundamentals");
  const chosen = rids.slice(0, extended ? 6 : movement ? 4 : 2);
  await as("", "postgres");
  for (const [i, rid] of rids.entries()) {
    const path = `${owner}/${rid}/${id(4600 + i)}.mp4`;
    await db.query(
      "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status,review_stage) values($1,$2,$3,$4,'video/mp4','synthetic.mp4','published','approved')",
      [
        rid,
        owner,
        {
          sport: "football",
          title: `Synthetic allocation ${i + 1}`,
          skill: "Footwork",
          ages: ["18+"],
          positions: [],
          levels: ["New to the game"],
          minutes: 3,
          equipment: "Markers",
          lesson: "Synthetic metadata, not coaching media",
          steps: ["Example"],
          cue: "Example",
          kind: "movement",
        },
        path,
      ],
    );
    await db.query(
      "update public.training_resources set review_stage='approved',status='published' where id=$1",
      [rid],
    );
    await db.query(
      'insert into storage.objects(bucket_id,name,metadata) values(\'training-media\',$1,\'{"size":100,"mimetype":"video/mp4"}\')',
      [path],
    );
  }
  await as();
  const payload = parseQuizCsv(EXAMPLE_QUIZ_CSV).quiz!;
  for (const [i, q] of qids.entries())
    await db.query("select public.learning_import_quiz($1,$2,$3,$4)", [
      q,
      id(4300 + i),
      `Synthetic IQ quiz ${i + 1}`,
      payload,
    ]);
  await db.query(
    "select public.learning_create_plan($1,'Official allocation test',2,$2,'{}','{}')",
    [p, packages],
  );
  const allocations: Record<
    string,
    { kind: string; quiz_version_id?: string }
  > = {};
  for (const [i, rid] of chosen.entries())
    allocations[rid] =
      i < 2
        ? { kind: "iq", quiz_version_id: qids[i] }
        : { kind: i < 4 ? "movement" : "position" };
  return { rids, chosen, qids, p, w, allocations };
}
async function checkedWeek(
  f: Awaited<ReturnType<typeof officialWeek>>,
  w = f.w,
  resources = f.chosen,
  quizzes = f.qids,
  allocations = f.allocations,
) {
  return db.query(
    "select public.learning_save_week_checked($1,$2,1,'Allocation week',$3,$4,$5)",
    [w, f.p, resources, quizzes, allocations],
  );
}
async function catalogWeek(w: string) {
  const result = (
    await db.query<{
      c: {
        plans: {
          weeks_content: {
            id: string;
            ready: boolean;
            resources: unknown[];
            readiness: {
              mode: string;
              complete: boolean;
              missing: string[];
              actual: Record<string, number>;
            };
          }[];
        }[];
      };
    }>("select public.learning_catalog() c")
  ).rows[0].c;
  return result.plans.flatMap((p) => p.weeks_content).find((x) => x.id === w)!;
}

it.each([
  ["foundation"],
  ["fundamentals"],
  ["position-development"],
  ["elite-coaching"],
  ["position-development", "elite-coaching"],
])(
  "requires the full official weekly allocation for %j",
  async (...packages: string[]) => {
    const f = await officialWeek(packages);
    await checkedWeek(f);
    let week = await catalogWeek(f.w);
    expect(week.ready).toBe(false);
    expect(week.readiness.complete, JSON.stringify(week.readiness)).toBe(true);
    expect(week.readiness.actual).toEqual({
      iq: 2,
      quizzes: 2,
      movement: packages.includes("foundation") ? 0 : 2,
      position: packages.some(
        (x) => x === "position-development" || x === "elite-coaching",
      )
        ? 2
        : 0,
    });
    await as(manager);
    await db.query("select public.learning_approve_week($1)", [f.w]);
    week = await catalogWeek(f.w);
    expect(week.ready).toBe(true);
    expect(week.readiness.mode).toBe("package");
    expect(week.readiness.missing).toEqual([]);
  },
);

it("a quiz-only approved-content week is not ready for a real package", async () => {
  const f = await officialWeek();
  await db.query(
    "select public.learning_save_week($1,$2,1,'Quiz-only draft','{}',$3)",
    [f.w, f.p, f.qids],
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [f.w],
    /Week not ready.*Football-IQ lessons/,
  );
  expect((await catalogWeek(f.w)).ready).toBe(false);
});

it("approved files and two quizzes alone cannot bypass missing classifications through the legacy RPC", async () => {
  const f = await officialWeek();
  await db.query(
    "select public.learning_save_week($1,$2,1,'Legacy draft',$3,$4)",
    [f.w, f.p, f.chosen, f.qids],
  );
  expect((await catalogWeek(f.w)).readiness.missing.join(" ")).toMatch(
    /Classify 2|Football-IQ lessons/,
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [f.w],
    /Week not ready.*Classify/,
  );
  expect((await catalogWeek(f.w)).ready).toBe(false);
});

it("missing and duplicate per-lesson quizzes, surplus drills and nonvideo IQ prevent approval", async () => {
  const f = await officialWeek();
  const missing = { ...f.allocations, [f.rids[1]]: { kind: "iq" } };
  await checkedWeek(f, f.w, f.chosen, f.qids, missing);
  expect((await catalogWeek(f.w)).readiness.missing.join(" ")).toMatch(
    /different included quiz/,
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [f.w],
    /different included quiz/,
  );
  const duplicated = {
    ...f.allocations,
    [f.rids[1]]: { kind: "iq", quiz_version_id: f.qids[0] },
  };
  await checkedWeek(f, id(4501), f.chosen, f.qids, duplicated);
  await blocked(
    "select public.learning_approve_week($1)",
    [id(4501)],
    /different included quiz/,
  );
  await checkedWeek(f, id(4502), [...f.chosen, f.rids[2]], f.qids, {
    ...f.allocations,
    [f.rids[2]]: { kind: "movement" },
  });
  await blocked(
    "select public.learning_approve_week($1)",
    [id(4502)],
    /Movement sessions: 1 selected; package requires 0/,
  );
  await as("", "postgres");
  await db.query(
    "update public.training_resources set asset_type='text/plain' where id=$1",
    [f.rids[0]],
  );
  await db.query(
    'update storage.objects set metadata=metadata||\'{"mimetype":"text/plain"}\' where name=(select asset_path from public.training_resources where id=$1)',
    [f.rids[0]],
  );
  await as();
  await checkedWeek(f, id(4503));
  await blocked(
    "select public.learning_approve_week($1)",
    [id(4503)],
    /need video media/,
  );
});

it("Position cannot be ready with only the two movement sessions, and incompatible package workloads are blocked", async () => {
  const f = await officialWeek(["position-development"]);
  const selected = f.chosen.slice(0, 4);
  const allocations = Object.fromEntries(
    selected.map((x) => [x, f.allocations[x]]),
  );
  await checkedWeek(f, f.w, selected, f.qids, allocations);
  expect((await catalogWeek(f.w)).readiness.missing).toContain(
    "Additional position drills: 0 selected; package requires 2.",
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [f.w],
    /Additional position drills/,
  );
  await db.query(
    "select public.learning_create_plan($1,'Incompatible mixed workload',2,'{foundation,fundamentals}','{}','{}')",
    [id(4401)],
  );
  await db.query(
    "select public.learning_save_week_checked($1,$2,1,'Mixed draft',$3,$4,$5)",
    [id(4504), id(4401), selected, f.qids, allocations],
  );
  await blocked(
    "select public.learning_approve_week($1)",
    [id(4504)],
    /separate plans/,
  );
});

it("classification writes remain staff-scoped, helpers stay private, and forged/duplicate selections are rejected", async () => {
  const f = await officialWeek();
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Forged',$3,$4,$5)",
    [
      f.w,
      f.p,
      f.chosen,
      f.qids,
      { ...f.allocations, [id(4999)]: { kind: "iq" } },
    ],
    /only selected lessons/,
  );
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Forged',$3,$4,$5)",
    [
      f.w,
      f.p,
      f.chosen,
      f.qids,
      { ...f.allocations, [f.rids[0]]: { kind: "iq", objective_points: 99 } },
    ],
    /supported fields/,
  );
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Duplicate',$3,$4,$5)",
    [f.w, f.p, [f.rids[0], f.rids[0]], f.qids, f.allocations],
    /duplicate/,
  );
  await blocked(
    "select public.learning_week_readiness($1)",
    [f.w],
    /permission denied/,
  );
  await blocked(
    "select public.learning_package_requirements('{foundation}')",
    [],
    /permission denied/,
  );
  await as(coach);
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Other author',$3,$4,$5)",
    [f.w, f.p, f.chosen, f.qids, f.allocations],
    /authoring scope/,
  );
  await as(parent);
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Household forgery',$3,$4,$5)",
    [f.w, f.p, f.chosen, f.qids, f.allocations],
    /Staff access/,
  );
});

it("checked saves are idempotent and immutable; a new linked quiz version does not rewrite a released week", async () => {
  const f = await officialWeek();
  await checkedWeek(f);
  await checkedWeek(f);
  await db.query("select public.learning_approve_week($1)", [f.w]);
  await db.query(
    "select public.learning_set_access($1,'foundation',now()-interval '1 day',now()+interval '1 year','Synthetic allocation test',false)",
    [profile],
  );
  await db.query("select public.learning_enroll($1,$2,$3,false)", [
    enrollment,
    profile,
    f.p,
  ]);
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true;update public.learning_enrollments set next_release_at=now()-interval '1 minute'",
  );
  await db.query("select public.learning_tick(now(),false)");
  const original = (
    await db.query<{ week_version_id: string }>(
      "select week_version_id from public.learning_releases where enrollment_id=$1",
      [enrollment],
    )
  ).rows[0];
  expect(original.week_version_id).toBe(f.w);
  await as();
  const nextQuiz = id(4202);
  await db.query(
    "select public.learning_import_quiz($1,$2,'Synthetic revised IQ quiz',$3)",
    [nextQuiz, id(4300), parseQuizCsv(EXAMPLE_QUIZ_CSV).quiz!],
  );
  const revised = {
    ...f.allocations,
    [f.rids[0]]: { kind: "iq", quiz_version_id: nextQuiz },
  };
  await blocked(
    "select public.learning_save_week_checked($1,$2,1,'Allocation week',$3,$4,$5)",
    [f.w, f.p, f.chosen, [nextQuiz, f.qids[1]], revised],
    /Week ID already exists/,
  );
  await checkedWeek(f, id(4505), f.chosen, [nextQuiz, f.qids[1]], revised);
  await db.query("select public.learning_approve_week($1)", [id(4505)]);
  await as(parent);
  const result = (
    await db.query<{
      a: {
        enrollments: {
          releases: {
            resources: { lesson_quiz_id: string }[];
            quizzes: { id: string }[];
          }[];
        }[];
      };
    }>("select public.learning_athlete($1) a", [profile])
  ).rows[0].a;
  expect(result.enrollments[0].releases[0].quizzes.map((x) => x.id)).toEqual(
    f.qids,
  );
  expect(
    result.enrollments[0].releases[0].resources.map((x) => x.lesson_quiz_id),
  ).toEqual(f.qids);
});

const noticePackage = id(810),
  otherNoticePackage = id(811);
async function notificationPackages() {
  await as();
  const rule = {
    weekday: 0,
    time: "00:00",
    timezone: "America/Chicago",
    grace_minutes: 60,
    escalation_minutes: 120,
    routing: "assigned_coach",
    notify_training: true,
    notify_reviews: true,
    email_requested: false,
    submission_reminders: false,
  };
  for (const [pkg, title] of [
    [noticePackage, "Fictional Foundation"],
    [otherNoticePackage, "Fictional Elite"],
  ])
    await db.query("select public.save_delivery_package($1,$2,$3,0)", [
      pkg,
      title,
      rule,
    ]);
  await db.query(
    "select public.save_delivery_override($1,'client',$2,'{}','active',0)",
    [profile, noticePackage],
  );
}
async function saveNotification(
  scope: "package" | "client" | "athlete",
  target: string,
  patch: unknown,
  version: number,
  selected: string | null = null,
) {
  await db.query(
    "select public.learning_save_notification_rule($1,$2,$3,$4,$5,$6)",
    [
      scope,
      scope === "package" ? null : target,
      scope === "package" ? target : null,
      patch,
      version,
      selected,
    ],
  );
}
async function notificationContext(target = profile) {
  return (await r("select public.learning_notification_workspace($1) r", [
    target,
  ])) as {
    effective: {
      friday_time: string;
      reminders_enabled: boolean;
      low_ready_weeks: number;
      staff_routing: string;
      training_notices: boolean;
    };
    athlete: {
      package_id: string | null;
      rules: unknown;
      version: number;
    } | null;
    client: { rules: unknown; version: number } | null;
  };
}
it("weekly settings inherit package/household/athlete precedence without granting access or crossing siblings", async () => {
  await notificationPackages();
  await saveNotification(
    "package",
    noticePackage,
    { friday_time: "18:00", low_ready_weeks: 4 },
    1,
  );
  await saveNotification(
    "package",
    otherNoticePackage,
    { friday_time: "21:00", low_ready_weeks: 1 },
    1,
  );
  await saveNotification("client", profile, { friday_time: "19:00" }, 1);
  await saveNotification(
    "athlete",
    profile,
    { friday_time: "20:00" },
    0,
    otherNoticePackage,
  );
  expect((await notificationContext()).effective).toMatchObject({
    friday_time: "20:00",
    low_ready_weeks: 1,
    reminders_enabled: true,
  });
  expect((await notificationContext(sibling)).effective).toMatchObject({
    friday_time: "19:00",
    low_ready_weeks: 4,
  });
  expect(
    (await notificationContext(otherProfile)).effective.friday_time,
  ).toMatch(/^17:00/);
  expect((await notificationContext()).athlete?.package_id).toBe(
    otherNoticePackage,
  );
  await as("", "postgres");
  expect(
    await r("select count(*)::integer r from public.learning_access"),
  ).toBe(0);
  expect(
    await r("select count(*)::integer r from public.learning_enrollments"),
  ).toBe(0);
});
it("weekly override retries are idempotent, reject stale writes and keep legacy edits compatible", async () => {
  await notificationPackages();
  await saveNotification(
    "athlete",
    profile,
    { reminders_enabled: false },
    0,
    otherNoticePackage,
  );
  await saveNotification(
    "athlete",
    profile,
    { reminders_enabled: false },
    0,
    otherNoticePackage,
  );
  expect((await notificationContext()).athlete?.version).toBe(1);
  await blocked(
    "select public.learning_save_notification_rule('athlete',$1,null,'{\"reminders_enabled\":true}',0,$2)",
    [profile, otherNoticePackage],
  );
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{\"grace_minutes\":15}','active',1)",
    [profile],
  );
  expect((await notificationContext()).athlete).toMatchObject({
    package_id: otherNoticePackage,
    rules: { reminders_enabled: false },
    version: 2,
  });
  await as("", "postgres");
  expect(
    await r(
      "select count(*)::integer r from public.learning_audit where action='configure_weekly_notifications'",
    ),
  ).toBe(1);
  expect(
    await r(
      "select rule ? 'friday_time' r from public.delivery_packages where id=$1",
      [noticePackage],
    ),
  ).toBe(false);
});
it("weekly rule configuration stays Owner-only and raw/private helper reads remain denied", async () => {
  await notificationPackages();
  for (const actor of [manager, coach, otherCoach, parent, otherParent]) {
    await as(actor);
    await blocked("select public.learning_notification_workspace($1)", [
      profile,
    ]);
    await blocked(
      "select public.learning_save_notification_rule('athlete',$1,null,'{}',0,null)",
      [profile],
    );
    await blocked("select public.learning_notification_rules($1)", [profile]);
    await blocked("select weekly_rules from public.delivery_athlete_settings");
  }
  await as("", "anon");
  await blocked("select public.learning_notification_workspace($1)", [profile]);
});
it("weekly rule validator rejects malformed clocks, thresholds, unknown fields and wrong targets", async () => {
  await notificationPackages();
  for (const patch of [
    null,
    [],
    { friday_time: "24:00" },
    { friday_time: 17 },
    { low_ready_weeks: 0 },
    { low_ready_weeks: 9 },
    { low_ready_weeks: 1.5 },
    { reminders_enabled: "false" },
    { email: true },
    { weekday: 3 },
  ]) {
    await blocked(
      "select public.learning_save_notification_rule('athlete',$1,null,$2,0,null)",
      [profile, patch],
      /choose|unknown|empty|valid/i,
    );
  }
  await blocked(
    "select public.learning_save_notification_rule('package',$1,$2,'{}',1,null)",
    [profile, noticePackage],
  );
  await blocked(
    "select public.learning_save_notification_rule('athlete',$1,null,'{}',0,$2)",
    [profile, id(9999)],
  );
});
it("effective Friday clock observes Chicago DST, opt-out and same-week dedup without changing releases", async () => {
  const rid = await release();
  await notificationPackages();
  await saveNotification("client", profile, { friday_time: "19:00" }, 1);
  await as("", "postgres");
  await db.query(
    "update public.learning_releases set available_at='2026-10-25 05:00Z' where id=$1",
    [rid],
  );
  await db.query(
    "update public.learning_enrollments set state='finished' where id=$1",
    [enrollment],
  );
  await db.query("select public.learning_tick('2026-10-30 23:59Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(0);
  await db.query("select public.learning_tick('2026-10-31 00:01Z',false)");
  await db.query("select public.learning_tick('2026-10-31 00:02Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(1);
  await db.query("select public.learning_tick('2026-11-07 00:59Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(1);
  await db.query("select public.learning_tick('2026-11-07 01:01Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete'",
    ),
  ).toBe(2);
  await as();
  await saveNotification("athlete", profile, { reminders_enabled: false }, 0);
  await as(parent);
  expect(
    JSON.stringify(await r("select public.learning_inbox() r")),
  ).not.toContain("friday_incomplete");
  await as("", "postgres");
  await db.query("select public.learning_tick('2026-11-07 01:01Z',false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='friday_incomplete' and resolved_at is null",
    ),
  ).toBe(0);
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
});
it("capacity threshold and staff routing inherit without widening Coach visibility", async () => {
  await setup();
  await notificationPackages();
  await saveNotification("package", noticePackage, { low_ready_weeks: 1 }, 1);
  await as("", "postgres");
  await db.exec(
    "update public.learning_settings set scheduler_enabled=true,notices_enabled=true",
  );
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where staff_only",
    ),
  ).toBe(0);
  await as();
  await saveNotification("athlete", profile, { low_ready_weeks: 3 }, 0);
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{\"routing\":\"owners_managers\"}','active',1)",
    [profile],
  );
  await as("", "postgres");
  await db.query("select public.learning_tick(now(),false)");
  await as(coach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
  await as(manager);
  expect(JSON.stringify(await r("select public.learning_inbox() r"))).toContain(
    "low_content",
  );
  await as(otherCoach);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
  await as(parent);
  expect(await r("select public.learning_inbox() r")).toEqual([]);
});
it("training-ready preference suppresses notices without hiding released content or backfilling", async () => {
  await notificationPackages();
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{\"notify_training\":false}','active',0)",
    [profile],
  );
  await release();
  await as("", "postgres");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='content_ready'",
    ),
  ).toBe(0);
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  await as(parent);
  expect(
    JSON.stringify(await r("select public.learning_athlete($1) r", [profile])),
  ).toContain("Fictional import");
  await as();
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{\"notify_training\":true}','active',1)",
    [profile],
  );
  await as("", "postgres");
  await db.query("select public.learning_tick(now(),false)");
  expect(
    await r(
      "select count(*)::integer r from public.learning_notices where category='content_ready'",
    ),
  ).toBe(0);
});
it("notification rollback preserves stored overrides, accounts and history without enabling flags", async () => {
  await release();
  await notificationPackages();
  await saveNotification(
    "athlete",
    profile,
    { friday_time: "19:00" },
    0,
    otherNoticePackage,
  );
  await as("", "postgres");
  const rollback = readFileSync(
    new URL(
      "../../backend/rollback/024-weekly-notification-overrides.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .replace(/^begin;$/m, "")
    .replace(/^commit;$/m, "");
  await db.exec("savepoint rollback_guard");
  await expect(db.exec(rollback)).rejects.toThrow(/Disable learning/);
  await db.exec("rollback to savepoint rollback_guard");
  await db.exec(
    "update public.learning_settings set enabled=false,scheduler_enabled=false,notices_enabled=false,youth_enabled=false",
  );
  await db.exec(rollback);
  expect(
    await r(
      "select weekly_rules r from public.delivery_athlete_settings where profile_id=$1",
      [profile],
    ),
  ).toEqual({ friday_time: "19:00" });
  expect(await r("select count(*)::integer r from auth.users")).toBe(6);
  expect(
    await r("select scheduler_enabled r from public.learning_settings"),
  ).toBe(false);
  expect(
    await r("select count(*)::integer r from public.learning_releases"),
  ).toBe(1);
  await as();
  expect(
    await r("select public.delivery_profile_workspace($1) is not null r", [
      profile,
    ]),
  ).toBe(true);
  await blocked(
    "select public.learning_notification_workspace($1)",
    [profile],
    /does not exist/,
  );
});

it("weekly override installation stops before DDL when learning flags are active", async () => {
  await as("", "postgres");
  const sql = readFileSync(
    new URL(
      "../../backend/024-weekly-notification-overrides.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .replace(/^begin;$/m, "")
    .replace(/^commit;$/m, "");
  await db.exec("savepoint install_guard");
  await expect(db.exec(sql)).rejects.toThrow(/Disable learning/);
  await db.exec("rollback to savepoint install_guard");
  expect(await r("select count(*)::integer r from auth.users")).toBe(6);
  expect(
    await r(
      "select count(*)::integer r from information_schema.columns where table_schema='public' and table_name='delivery_athlete_settings' and column_name='weekly_package_id'",
    ),
  ).toBe(1);
});
