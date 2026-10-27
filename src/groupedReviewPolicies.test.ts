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
    "013-preview-review-groups.sql",
    "014-grouped-review-fulfillment.sql",
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
  await db.query(
    "insert into public.member_training_access(account_id,resource_ids,video_review_enabled,review_coach_id) values($1,$2,true,$3)",
    [parent, [first, second, third], coach],
  );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
const group = id(80);
function manifest(count = 3, seconds = 60) {
  return Array.from({ length: count }, (_, n) => ({
    id: id(100 + n),
    training_id: first,
    duration_seconds: seconds,
    byte_size: 1000,
    media_type: "video/mp4",
  }));
}
type Detail = {
  id: string;
  version: number;
  state: string;
  due_at: string | null;
  group_submitted_at: string | null;
  feedback: string;
  erased: boolean;
  clips: { id: string; asset_path: string; status: string }[];
};
async function value<T = Detail>(sql: string, args: unknown[] = []) {
  return (await db.query<{ result: T }>(`select ${sql} result`, args)).rows[0]
    .result;
}
async function enable() {
  await as("", "postgres");
  await db.exec("update public.review_group_settings set enabled=true");
}
async function create(m = manifest(), key = group, target = profile) {
  return value("public.create_review_group($1,$2,$3)", [
    key,
    target,
    JSON.stringify(m),
  ]);
}
async function deny(sql: string, args: unknown[], pattern: RegExp) {
  await db.exec("savepoint denied");
  await expect(value(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint denied");
}
async function finish(n: number) {
  await as("", "postgres");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) select 'athlete-review-videos',asset_path,jsonb_build_object('size',byte_size,'mimetype',media_type) from public.athlete_video_reviews where id=$1",
    [id(100 + n)],
  );
  await as(parent);
  await value("public.finish_athlete_video($1)", [id(100 + n)]);
}
it("defaults OFF and denies client activation; reserves three clips atomically as one draft with no deadline or credits", async () => {
  await as(parent);
  await deny(
    "public.create_review_group($1,$2,$3)",
    [group, profile, JSON.stringify(manifest())],
    /not enabled/,
  );
  await db.exec("savepoint setting");
  await expect(
    db.exec("update public.review_group_settings set enabled=true"),
  ).rejects.toThrow(/permission denied/);
  await db.exec("rollback to savepoint setting");
  await enable();
  await as(parent);
  const a = await create(),
    b = await create();
  expect(b).toEqual(a);
  expect(a).toMatchObject({
    state: "uploading",
    due_at: null,
    group_submitted_at: null,
  });
  expect(a.clips).toHaveLength(3);
  await as("", "postgres");
  expect(
    (await db.query("select count(*)::integer n from public.review_services"))
      .rows,
  ).toEqual([{ n: 1 }]);
  expect(
    (
      await db.query(
        "select count(*)::integer n from public.athlete_video_reviews",
      )
    ).rows,
  ).toEqual([{ n: 3 }]);
});
it("enforces duration/count and unchanged storage caps before creating any partial draft", async () => {
  await enable();
  await as(parent);
  await deny(
    "public.create_review_group($1,$2,$3)",
    [group, profile, JSON.stringify(manifest(4, 45))],
    /one to three/,
  );
  await deny(
    "public.create_review_group($1,$2,$3)",
    [group, profile, JSON.stringify(manifest(3, 60.1))],
    /at most 60/,
  );
  await create();
  await deny(
    "public.create_review_group($1,$2,$3)",
    [
      id(81),
      profile,
      JSON.stringify(manifest().map((c, n) => ({ ...c, id: id(110 + n) }))),
    ],
    /storage capacity/,
  );
  await as("", "postgres");
  expect(
    (await db.query("select count(*)::integer n from public.review_services"))
      .rows,
  ).toEqual([{ n: 1 }]);
});
it("keeps partial uploads private, retries stable IDs and submits exactly one review and 48-hour deadline", async () => {
  await enable();
  await as(parent);
  await create();
  await finish(0);
  await as(coach);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toEqual([]);
  await deny("public.review_group_detail($1)", [group], /unavailable/);
  await as(parent);
  await deny("public.submit_review_group($1)", [group], /Upload every/);
  await value("public.finish_athlete_video($1)", [id(100)]);
  await deny("public.finish_athlete_video($1)", [id(101)], /complete upload/);
  await finish(1);
  await finish(2);
  await as(parent);
  const a = await value("public.submit_review_group($1)", [group]);
  const b = await value("public.submit_review_group($1)", [group]);
  expect(b.due_at).toBe(a.due_at);
  expect(a.state).toBe("queued");
  expect(Date.parse(a.due_at!) - Date.parse(a.group_submitted_at!)).toBe(
    48 * 3600000,
  );
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select count(*)::integer n from public.review_service_events where event='group_submitted'",
      )
    ).rows,
  ).toEqual([{ n: 1 }]);
});
it("denies other households, operational managers and unassigned coaches; one assigned response fulfills the whole group idempotently", async () => {
  await enable();
  await as(parent);
  await create();
  await finish(0);
  await finish(1);
  await finish(2);
  await as(parent);
  const ready = await value("public.submit_review_group($1)", [group]);
  for (const actor of [otherParent, owner, manager]) {
    await as(actor);
    expect(
      (
        await db.query(
          "select name from storage.objects where bucket_id='athlete-review-videos'",
        )
      ).rows,
    ).toEqual([]);
    await deny("public.review_group_detail($1)", [group], /unavailable/);
    await deny(
      "public.save_review_group_feedback($1,'No',1)",
      [group],
      /Assigned coach/,
    );
  }
  await as(coach);
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='athlete-review-videos'",
      )
    ).rows,
  ).toHaveLength(3);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toHaveLength(3);
  await deny(
    "public.save_athlete_video_feedback($1,'Partial',2)",
    [id(100)],
    /complete review group/,
  );
  const started = await value("public.start_review_group($1,$2)", [
    group,
    ready.version,
  ]);
  const done = await value("public.save_review_group_feedback($1,$2,$3)", [
    group,
    "One clear fictional coaching response.",
    started.version,
  ]);
  expect(
    await value("public.save_review_group_feedback($1,$2,$3)", [
      group,
      done.feedback,
      started.version,
    ]),
  ).toEqual(done);
  expect(done).toMatchObject({
    state: "delivered",
    feedback: "One clear fictional coaching response.",
    due_at: ready.due_at,
  });
  await as(parent);
  expect(
    (await value("public.review_group_detail($1)", [group])).feedback,
  ).toBe(done.feedback);
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select count(*)::integer n from public.review_service_events where event='group_feedback_saved'",
      )
    ).rows,
  ).toEqual([{ n: 1 }]);
});
it("retains the deadline across reassignment and rejects stale feedback after access changes", async () => {
  await enable();
  await as(parent);
  await create(manifest(1));
  await finish(0);
  await as(parent);
  const ready = await value("public.submit_review_group($1)", [group]);
  await as(owner);
  await value("public.manage_review_service($1,$2,'none',$3)", [
    group,
    manager,
    ready.version,
  ]);
  await as(coach);
  await deny("public.review_group_detail($1)", [group], /unavailable/);
  await as(manager);
  const next = await value("public.review_group_detail($1)", [group]);
  expect(next.due_at).toBe(ready.due_at);
  await deny(
    "public.save_review_group_feedback($1,'Changed',$2)",
    [group, ready.version],
    /Review changed/,
  );
});
it("requires explicit media deletion, removes feedback with deleted media and allows partial-cleanup retry without quota expansion", async () => {
  await enable();
  await as(parent);
  await create(manifest(2));
  await finish(0);
  await finish(1);
  await as(parent);
  await value("public.submit_review_group($1)", [group]);
  await as(coach);
  const g = await value("public.review_group_detail($1)", [group]);
  await value("public.save_review_group_feedback($1,'Fictional feedback',$2)", [
    group,
    g.version,
  ]);
  await as(parent);
  await deny("public.delete_review_group($1)", [group], /stored clips/);
  await as("", "postgres");
  await db.query("delete from storage.objects where name like $1", [
    `%/${id(100)}.mp4`,
  ]);
  await as(parent);
  await value("public.delete_athlete_video($1)", [id(100)]);
  const erased = await value("public.review_group_detail($1)", [group]);
  expect(erased.erased).toBe(true);
  expect(erased.feedback).toBe("");
  expect(erased.clips).toHaveLength(1);
  await as("", "postgres");
  await db.exec("delete from storage.objects");
  await as(parent);
  await value("public.delete_review_group($1)", [group]);
  await value("public.delete_review_group($1)", [group]);
  expect(
    (await value("public.review_group_detail($1)", [group])).clips,
  ).toHaveLength(0);
});
it("keeps consent/access revocation, account closure and profile erasure guards", async () => {
  await enable();
  await as(parent);
  await create(manifest(1));
  await as(otherParent);
  await deny(
    "public.create_review_group($1,$2,$3)",
    [
      id(82),
      profile,
      JSON.stringify(manifest(1).map((c) => ({ ...c, id: id(120) }))),
    ],
    /unavailable/,
  );
  await as("", "postgres");
  await db.query(
    "update public.member_training_access set video_review_enabled=false where account_id=$1",
    [parent],
  );
  await as(parent);
  await deny("public.submit_review_group($1)", [group], /unavailable/);
  await as("", "postgres");
  await db.query(
    "insert into public.account_closures(id,user_id,state) values($1,$2,'cleaning')",
    [id(500), parent],
  );
  await as(parent);
  await deny("public.review_group_detail($1)", [group], /unavailable/);
  await as("", "postgres");
  await db.exec("savepoint profile_cleanup");
  await expect(
    db.query("delete from public.player_profiles where id=$1", [profile]),
  ).rejects.toThrow(/video reviews before/);
  await db.exec("rollback to savepoint profile_cleanup");
  await db.query(
    "delete from public.athlete_video_reviews where profile_id=$1",
    [profile],
  );
  await db.query("delete from public.player_profiles where id=$1", [profile]);
  expect(
    (await db.query("select count(*)::integer n from public.review_services"))
      .rows,
  ).toEqual([{ n: 0 }]);
  expect(
    (
      await db.query(
        "select count(*)::integer n from public.athlete_video_reviews",
      )
    ).rows,
  ).toEqual([{ n: 0 }]);
});
it("upgrades one unfulfilled legacy request without creating a second service or early deadline", async () => {
  await enable();
  await as(parent);
  await value("public.request_drill_review($1,$2)", [group, profile]);
  const next = await create(manifest(2));
  expect(next).toMatchObject({ id: group, state: "uploading", due_at: null });
  await as("", "postgres");
  expect(
    (await db.query("select count(*)::integer n from public.review_services"))
      .rows,
  ).toEqual([{ n: 1 }]);
});
it("enforces the existing shared byte budget when atomically reserving a new group", async () => {
  await enable();
  await as("", "postgres");
  for (let n = 0; n < 8; n++) {
    const account = n < 4 ? parent : otherParent,
      p = n < 4 ? profile : otherProfile;
    await db.query(
      `insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds)
      values($1,$2,$3,$3,$4,'Fictional reservation',$5,'video/mp4',$6,30)`,
      [
        id(600 + n),
        p,
        account,
        first,
        `${account}/${p}/${id(600 + n)}.mp4`,
        n < 4 ? 35 * 1024 * 1024 : 40 * 1024 * 1024,
      ],
    );
  }
  // 140 + 160 MiB is the unchanged 300-MiB budget. One own slot remains.
  await as(parent);
  await deny(
    "public.create_review_group($1,$2,$3)",
    [group, profile, JSON.stringify(manifest(1))],
    /storage capacity/,
  );
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select count(*)::integer n from public.review_services where is_grouped",
      )
    ).rows,
  ).toEqual([{ n: 0 }]);
});
