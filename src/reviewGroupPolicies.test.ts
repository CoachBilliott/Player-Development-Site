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
function clips(count = 3, seconds = 60) {
  return Array.from({ length: count }, (_, n) => ({
    id: id(100 + n),
    training_id: first,
    duration_seconds: seconds,
    byte_size: 1000,
    media_type: "video/mp4",
  }));
}
async function preview(items: unknown = clips(), target = profile) {
  return (
    await db.query<{ result: Record<string, unknown> }>(
      "select public.preview_drill_review_group($1,$2) result",
      [target, JSON.stringify(items)],
    )
  ).rows[0].result;
}
async function deny(items: unknown, pattern: RegExp, target = profile) {
  await db.exec("savepoint invalid_group");
  await expect(preview(items, target)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint invalid_group");
}
async function stored(
  account = parent,
  p = profile,
  count = 4,
  bytes = 1000,
  start = 200,
) {
  for (let n = 0; n < count; n++)
    await db.query(
      `insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds)
  values($1,$2,$3,$3,$4,'Fictional original test drill',$5,'video/mp4',$6,30)`,
      [
        id(start + n),
        p,
        account,
        first,
        `${account}/${p}/${id(start + n)}.mp4`,
        bytes,
      ],
    );
}
it("previews exactly three 60-second clips as one 180-second proposal without requests, files, reservations or credits", async () => {
  await as(parent);
  const result = await preview();
  expect(result).toMatchObject({
    preview_only: true,
    grouped_submission_available: false,
    clip_count: 3,
    total_seconds: 180,
    total_bytes: 3000,
    storage_capacity_available: true,
    stored_clip_slots_available: 5,
    monthly_credits_active: false,
    funding: "manual_pilot",
  });
  expect(await preview()).toEqual(result);
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select (select count(*)::integer from public.athlete_video_reviews) videos,(select count(*)::integer from public.review_services) services,(select count(*)::integer from storage.objects) objects",
      )
    ).rows,
  ).toEqual([{ videos: 0, services: 0, objects: 0 }]);
});
it("rejects empty, fourth, duplicate, overlong and mixed-drill plans while accepting fractional declared totals", async () => {
  await as(parent);
  expect(await preview(clips(3, 59.5))).toMatchObject({ total_seconds: 178.5 });
  expect(await preview(clips(1, 60))).toMatchObject({
    clip_count: 1,
    total_seconds: 60,
  });
  await deny([], /one to three/);
  await deny(clips(4, 45), /one to three/);
  await deny(clips(3, 60.001), /at most 60/);
  await deny(clips(1, 0), /at most 60/);
  const duplicate = clips(2);
  duplicate[1].id = duplicate[0].id;
  await deny(duplicate, /each clip once/);
  const mixed = clips(2);
  mixed[1].training_id = third;
  await deny(mixed, /same athlete and drill/);
});
it("separates storage headroom from the proposed review count and never raises the account cap", async () => {
  await as("", "postgres");
  await stored();
  await as(parent);
  expect(await preview(clips(1))).toMatchObject({
    storage_capacity_available: true,
    stored_clip_slots_available: 1,
    monthly_credits_active: false,
  });
  expect(await preview(clips(2))).toMatchObject({
    storage_capacity_available: false,
    stored_clip_slots_available: 1,
  });
  await as("", "postgres");
  expect(
    (
      await db.query(
        "select count(*)::integer total from public.athlete_video_reviews",
      )
    ).rows,
  ).toEqual([{ total: 4 }]);
});
it("retains the shared 300-MiB safeguard without exposing another household's storage usage", async () => {
  await as("", "postgres");
  await stored(parent, profile, 4, 25 * 1024 * 1024);
  await stored(otherParent, otherProfile, 5, 40 * 1024 * 1024, 300);
  await as(parent);
  const result = await preview(clips(1));
  expect(result).toMatchObject({
    storage_capacity_available: false,
    stored_clip_slots_available: 1,
  });
  expect(Object.keys(result).sort()).toEqual(
    [
      "preview_only",
      "grouped_submission_available",
      "profile_id",
      "training_id",
      "clip_count",
      "total_seconds",
      "total_bytes",
      "storage_capacity_available",
      "stored_clip_slots_available",
      "monthly_credits_active",
      "funding",
    ].sort(),
  );
});
it("denies unrelated households, staff and anonymous callers; audience changes and reserved IDs cannot be reused", async () => {
  for (const actor of [otherParent, owner, manager, coach]) {
    await as(actor);
    await deny(clips(), /access is unavailable/);
  }
  await as("", "anon");
  await deny(clips(), /permission denied/);
  await as(parent);
  await deny(clips(), /drill is unavailable/, sibling);
  await as("", "postgres");
  await stored(parent, profile, 1, 1000, 100);
  await as(parent);
  await deny(clips(1), /already reserved/);
  await as("", "postgres");
  await db.query(
    "update public.training_resources set review_stage='changes_requested',status='draft' where id=$1",
    [first],
  );
  await as(parent);
  await deny(
    clips(1).map((c) => ({ ...c, id: id(110) })),
    /drill is unavailable/,
  );
});
it("requires real numeric bounded metadata and supported formats; a preview never verifies actual media duration", async () => {
  await as(parent);
  for (const change of [
    { duration_seconds: "60" },
    { byte_size: 1.5 },
    { byte_size: 41943041 },
    { byte_size: 0 },
    { media_type: "text/plain" },
  ])
    await deny([{ ...clips(1)[0], ...change }], /valid duration|at most 60/);
  await deny({ clips: clips() }, /one to three/);
});
it("respects linked-adult recording permission, revocation, closing accounts and known-minor guards", async () => {
  const linked = id(7);
  await as("", "postgres");
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-linked-group@example.test',now())",
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
  await deny(clips(), /access is unavailable/);
  await as("", "postgres");
  await db.query(
    "insert into public.family_athlete_controls(profile_id,self_recording_allowed) values($1,true)",
    [profile],
  );
  await as(linked);
  expect(await preview()).toMatchObject({ preview_only: true });
  await deny(clips(), /access is unavailable/, sibling);
  await as("", "postgres");
  await db.query(
    "update public.family_athlete_links set revoked_at=now() where profile_id=$1",
    [profile],
  );
  await as(linked);
  await deny(clips(), /access is unavailable/);
  await as("", "postgres");
  await db.query(
    "insert into public.family_minor_profiles(profile_id) values($1)",
    [profile],
  );
  await as(parent);
  await deny(clips(), /access is unavailable/);
  await as("", "postgres");
  await db.query(
    "delete from public.family_minor_profiles where profile_id=$1",
    [profile],
  );
  await db.query(
    "insert into public.account_closures(id,user_id,state) values($1,$2,'cleaning')",
    [id(400), parent],
  );
  await as(parent);
  await deny(clips(), /access is unavailable|deletion/);
});
