import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
let db: PGlite;
const id = (n: number) =>
  `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, manager, coach, parent, other, recipient] = [
  1, 2, 3, 4, 5, 6,
].map(id);
const profile = id(10),
  otherProfile = id(11),
  request = id(30);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated',created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
  create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
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
  for (const [user, role] of [
    [owner, "owner"],
    [manager, "manager"],
    [coach, "coach"],
    [parent, "parent"],
    [other, "parent"],
  ]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [user, `fictional-${user}@example.test`],
    );
    await db.query(
      "insert into public.account_roles(user_id,role) values($1,$2)",
      [user, role],
    );
  }
  await db.exec(`insert into public.member_accounts(user_id,account_type) values('${parent}','parent'),('${other}','parent');
  insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal) values
  ('${profile}','${parent}','Fictional adult','18+','Quarterback','New to the game','Footwork'),
  ('${otherProfile}','${other}','Other fictional adult','18+','Quarterback','New to the game','Footwork');`);
  await db.exec(
    readFileSync(
      new URL(
        "../backend/010-account-invitations-and-closure.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../backend/011-review-service-tracking.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function value<T>(query: string, args: unknown[] = []) {
  await db.exec("savepoint service_check");
  try {
    const result = (
      await db.query<{ value: T }>(`select ${query} as value`, args)
    ).rows[0].value;
    await db.exec("release savepoint service_check");
    return result;
  } catch (e) {
    await db.exec(
      "rollback to savepoint service_check; release savepoint service_check",
    );
    throw e;
  }
}
async function requestReview(actor = parent, p = profile, key = request) {
  await as(actor);
  return value<Record<string, unknown>>("public.request_drill_review($1,$2)", [
    key,
    p,
  ]);
}
async function desk(actor = owner) {
  await as(actor);
  return value<{
    requests: Record<string, unknown>[];
    staff: Record<string, unknown>[];
  }>("public.review_service_desk()");
}
async function upload(status = "uploading") {
  await as("", "postgres");
  await db.query(
    "insert into public.member_training_access(account_id,video_review_enabled,review_coach_id) values($1,true,$2)",
    [parent, coach],
  );
  await db.query(
    `insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,drill_title,asset_path,media_type,byte_size,duration_seconds,status) values($1,$2,$3,$3,'Fictional original drill',$4,'video/mp4',100,2,$5)`,
    [id(40), profile, parent, `${parent}/${profile}/${id(40)}.mp4`, status],
  );
}
it("repeated customer requests produce one shared request and no payment record", async () => {
  const first = await requestReview();
  const next = await requestReview(parent, profile, id(31));
  expect(next.id).toBe(first.id);
  const d = await desk(manager);
  expect(d.requests).toHaveLength(1);
  expect(d.requests[0].funding).toBe("manual_pilot");
  expect(d.requests[0].state).toBe("requested");
  expect(d.requests[0].due_at).toBeNull();
  expect(d.requests[0]).not.toHaveProperty("asset_path");
  expect(d.requests[0]).not.toHaveProperty("nickname");
  expect(d.requests[0]).not.toHaveProperty("feedback");
});
it("unrelated customers, coaches, roleless users and anonymous callers cannot read or manage the service desk", async () => {
  await requestReview();
  for (const actor of [parent, other, coach, recipient]) {
    await expect(desk(actor)).rejects.toThrow();
  }
  await as("", "anon");
  await expect(value("public.review_service_desk()")).rejects.toThrow();
  await as(other);
  await expect(
    value("public.my_review_services($1)", [profile]),
  ).rejects.toThrow();
  await expect(
    value("public.request_drill_review($1,$2)", [id(31), profile]),
  ).rejects.toThrow();
});
it("requests can be cancelled once with optimistic version checks", async () => {
  const r = await requestReview();
  await value("public.cancel_drill_review($1,$2)", [r.id, r.version]);
  await expect(
    value("public.cancel_drill_review($1,$2)", [r.id, r.version]),
  ).rejects.toThrow();
  expect((await desk()).requests[0].state).toBe("cancelled");
});
it("actual uploads attach to an existing request and begin the fixed clock only when ready", async () => {
  await requestReview();
  await upload();
  let d = await desk();
  expect(d.requests).toHaveLength(1);
  expect(d.requests[0].video_id).toBe(id(40));
  expect(d.requests[0].state).toBe("uploading");
  expect(d.requests[0].due_at).toBeNull();
  await as("", "postgres");
  await db.query(
    "update public.athlete_video_reviews set status='pending_parent' where id=$1",
    [id(40)],
  );
  d = await desk();
  expect(d.requests[0].due_at).toBeNull();
  await as(parent);
  await value("public.approve_athlete_video($1,1)", [id(40)]);
  d = await desk();
  const row = d.requests[0];
  expect(row.state).toBe("queued");
  expect(
    Date.parse(String(row.due_at)) - Date.parse(String(row.ready_at)),
  ).toBe(48 * 3600000);
  await as(manager);
  await value("public.manage_review_service($1,$2,'technical_issue',$3)", [
    row.id,
    coach,
    row.version,
  ]);
  expect((await desk()).requests[0].due_at).toBe(row.due_at);
});
it("direct submissions automatically enter the queue and only saved feedback delivers a review", async () => {
  await upload("queued");
  const d = await desk();
  expect(d.requests).toHaveLength(1);
  let row = d.requests[0];
  await as(coach);
  await value("public.start_drill_review($1,1)", [id(40)]);
  await value("public.start_drill_review($1,1)", [id(40)]);
  row = (await desk()).requests[0];
  expect(row.state).toBe("in_review");
  expect(row.delivered_at).toBeNull();
  await as(coach);
  await expect(
    value("public.save_athlete_video_feedback($1,' ',1)", [id(40)]),
  ).rejects.toThrow();
  await value(
    "public.save_athlete_video_feedback($1,'Good control. Keep your steps short; repeat slowly.',1)",
    [id(40)],
  );
  row = (await desk()).requests[0];
  expect(row.state).toBe("delivered");
  expect(row.delivered_at).toBeTruthy();
});
it("Manager assignment affects only that ready clip, never profile access or other households", async () => {
  await upload("queued");
  const row = (await desk()).requests[0];
  await as(manager);
  expect(await value("public.can_view_athlete_video($1)", [id(40)])).toBe(
    false,
  );
  await value("public.manage_review_service($1,$2,'none',$3)", [
    row.id,
    manager,
    row.version,
  ]);
  expect(await value("public.can_view_athlete_video($1)", [id(40)])).toBe(true);
  expect(await value("public.can_view_athlete($1)", [profile])).toBe(false);
  expect(await value("public.can_view_athlete($1)", [otherProfile])).toBe(
    false,
  );
  await as(coach);
  expect(await value("public.can_view_athlete_video($1)", [id(40)])).toBe(
    false,
  );
  await expect(
    value("public.save_athlete_video_feedback($1,'Unauthorized',1)", [id(40)]),
  ).rejects.toThrow();
  await as(manager);
  await expect(
    value("public.manage_review_service($1,$2,'none',$3)", [
      row.id,
      coach,
      row.version,
    ]),
  ).rejects.toThrow();
});
it("revoked account access and account deletion freeze block clips and feedback", async () => {
  await upload("queued");
  await as("", "postgres");
  await db.query(
    "update public.member_training_access set video_review_enabled=false where account_id=$1",
    [parent],
  );
  await as(coach);
  expect(await value("public.can_view_athlete_video($1)", [id(40)])).toBe(
    false,
  );
  await expect(
    value("public.save_athlete_video_feedback($1,'No access',1)", [id(40)]),
  ).rejects.toThrow();
  await as("", "service_role");
  await value("public.begin_account_closure($1,$2)", [parent, id(50)]);
  await as(parent);
  await expect(
    value("public.request_drill_review($1,$2)", [id(31), profile]),
  ).rejects.toThrow();
  expect((await desk()).requests).toHaveLength(0);
});
it("removing a clip cancels unfinished service and account cleanup cascades metadata and audit", async () => {
  await upload("queued");
  await as(parent);
  await value("public.delete_athlete_video($1)", [id(40)]);
  const d = await desk();
  expect(d.requests[0].state).toBe("cancelled");
  expect(d.requests[0].video_id).toBeNull();
  await as("", "postgres");
  await db.query("delete from public.member_accounts where user_id=$1", [
    parent,
  ]);
  expect(await value("(select count(*) from public.review_services)")).toBe(0);
  expect(
    await value("(select count(*) from public.review_service_events)"),
  ).toBe(0);
});
it("real junior requests remain unavailable", async () => {
  await as("", "postgres");
  await db.exec("update public.profile_settings set under18_enabled=true");
  await db.query(
    "insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal,guardian_confirmed) values($1,$2,'Fictional junior','13–17','Quarterback','New to the game','Footwork',true)",
    [id(12), parent],
  );
  await as(parent);
  await expect(
    value("public.request_drill_review($1,$2)", [id(31), id(12)]),
  ).rejects.toThrow();
});
