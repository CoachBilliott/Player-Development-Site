import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
let db: PGlite;
const uid = (n: number) =>
  `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, coach, otherCoach, parent, athlete, stranger] = [
  1, 2, 3, 4, 5, 6,
].map(uid);
const profile = uid(10),
  individual = uid(11),
  minor = uid(12),
  resource = uid(20),
  wrongAge = uid(21),
  clip = uid(30);
const path = `${coach}/${resource}/${resource}.mp4`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  for (let n = 1; n <= 6; n++)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [uid(n), `fictional-review-${n}@example.test`],
    );
  for (const name of [
    "001-shared-content.sql",
    "002-private-profiles.sql",
    "003-account-levels.sql",
    "004-family-athletes.sql",
    "005-content-audiences.sql",
    "006-assigned-training-and-video-review.sql",
    "007-training-assignment-cleanup.sql",
  ])
    await db.exec(
      readFileSync(new URL("../backend/" + name, import.meta.url), "utf8"),
    );
  await db.exec(`insert into public.member_accounts(user_id,account_type) values('${parent}','parent'),('${athlete}','adult'),('${stranger}','adult');
 insert into public.account_roles(user_id,role) values('${owner}','owner'),('${coach}','coach'),('${otherCoach}','coach'),('${parent}','parent'),('${athlete}','athlete'),('${stranger}','athlete');
 update public.profile_settings set under18_enabled=true;
 insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal,guardian_confirmed) values
 ('${profile}','${parent}','Fictional family adult','18+','Quarterback','New to the game','Footwork',false),
 ('${individual}','${athlete}','Fictional solo adult','18+','Quarterback','New to the game','Footwork',false),
 ('${minor}','${parent}','Fictional junior','13–17','Quarterback','New to the game','Footwork',true);`);
  const content = {
    sport: "football",
    title: "Original test drill",
    skill: "Footwork",
    ages: ["18+"],
    positions: ["Quarterback"],
    levels: ["New to the game"],
    minutes: 3,
    equipment: "Clear flat space",
    lesson: "Pending qualified review.",
    steps: ["Walk between markers."],
    cue: "Slow steps.",
    kind: "movement",
  };
  for (const [id, ages] of [
    [resource, ["18+"]],
    [wrongAge, ["5–7"]],
  ] as const)
    await db.query(
      "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values($1,$2,$3,$4,'video/mp4','original.mp4','published')",
      [id, coach, { ...content, ages }, `${coach}/${id}/${id}.mp4`],
    );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('training-media',$1)",
    [path],
  );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function grant(account = parent, enabled = true) {
  await as(owner);
  await db.query("select public.set_member_training_access($1,$2,$3,$4,0)", [
    account,
    [resource, wrongAge],
    enabled,
    enabled ? coach : null,
  ]);
}
async function begin(account = parent, p = profile) {
  await grant(account);
  await as(account);
  return (
    await db.query<{ asset_path: string }>(
      "select * from public.begin_athlete_video($1,$2,$3,'video/mp4',100,10)",
      [clip, p, resource],
    )
  ).rows[0];
}
async function uploaded() {
  const v = await begin();
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,$2)",
    [v.asset_path, { size: 100, mimetype: "video/mp4" }],
  );
  await db.query("select public.finish_athlete_video($1)", [clip]);
  return v;
}
it("keeps protected drills and videos unavailable without an Owner grant", async () => {
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([]);
  await expect(
    db.query("select public.begin_athlete_video($1,$2,$3,'video/mp4',100,10)", [
      clip,
      profile,
      resource,
    ]),
  ).rejects.toThrow(/unavailable/);
});
it("only allows Owners to grant access and rejects stale writes", async () => {
  await as(coach);
  await expect(
    db.query("select public.set_member_training_access($1,$2,true,$3,0)", [
      parent,
      [resource],
      coach,
    ]),
  ).rejects.toThrow(/Only Owners/);
});
it("matches assigned media to age and denies another household and unassigned content", async () => {
  await grant();
  await as(parent);
  expect(
    (
      await db.query("select id from public.athlete_training_plan($1)", [
        profile,
      ])
    ).rows,
  ).toEqual([{ id: resource }]);
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='training-media'",
      )
    ).rows,
  ).toEqual([{ name: path }]);
  await as(stranger);
  expect(
    (await db.query("select id from public.training_resources")).rows,
  ).toEqual([]);
  await expect(
    db.query("select * from public.athlete_training_plan($1)", [profile]),
  ).rejects.toThrow(/unavailable/);
});
it("refuses junior clips even when ordinary child workout enrollment is enabled", async () => {
  await grant();
  await as(parent);
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select public.can_submit_athlete_video($1) allowed",
        [minor],
      )
    ).rows[0].allowed,
  ).toBe(false);
  await expect(
    db.query("select public.begin_athlete_video($1,$2,$3,'video/mp4',100,10)", [
      clip,
      minor,
      resource,
    ]),
  ).rejects.toThrow(/unavailable/);
});
it("requires a complete stored object before reporting a successful submission", async () => {
  await begin();
  await expect(
    db.query("select public.finish_athlete_video($1)", [clip]),
  ).rejects.toThrow(/complete upload/);
});
it("isolates the reserved folder and makes repeated send/finalize idempotent", async () => {
  const v = await uploaded();
  await db.query("select public.finish_athlete_video($1)", [clip]);
  expect(
    (await db.query("select id,status from public.athlete_video_reviews")).rows,
  ).toEqual([{ id: clip, status: "queued" }]);
  await as(stranger);
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='athlete-review-videos'",
      )
    ).rows,
  ).toEqual([]);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,$2)",
      [v.asset_path, { size: 100 }],
    ),
  ).rejects.toThrow(/row-level security/);
});
it("only gives the assigned coach video access; Owners do not automatically see private clips", async () => {
  await uploaded();
  for (const person of [otherCoach, owner, stranger]) {
    await as(person);
    expect(
      (await db.query("select id from public.athlete_video_reviews")).rows,
    ).toEqual([]);
  }
  await as(coach);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toEqual([{ id: clip }]);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([]);
});
it("saves feedback without allowing customers to forge it", async () => {
  await uploaded();
  await as(coach);
  await db.query(
    "select public.save_athlete_video_feedback($1,'Keep your steps controlled.',2)",
    [clip],
  );
  await as(parent);
  expect(
    (await db.query("select status,feedback from public.athlete_video_reviews"))
      .rows,
  ).toEqual([{ status: "reviewed", feedback: "Keep your steps controlled." }]);
  await expect(
    db.query(
      "update public.athlete_video_reviews set feedback='Forged' where id=$1",
      [clip],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("revokes coach access immediately when the feature is disabled", async () => {
  await uploaded();
  await as(owner);
  await db.query(
    "select public.set_member_training_access($1,$2,false,null,1)",
    [parent, [resource]],
  );
  await as(coach);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='athlete-review-videos'",
      )
    ).rows,
  ).toEqual([]);
});
it("keeps athlete-uploaded family clips out of the coach queue until parent approval", async () => {
  await grant();
  await db.exec("reset role");
  await db.query("delete from public.player_profiles where id=$1", [
    individual,
  ]);
  await db.query(
    "insert into public.family_athlete_links(profile_id,athlete_user_id) values($1,$2)",
    [profile, athlete],
  );
  await db.query(
    "insert into public.family_athlete_controls(profile_id,self_recording_allowed) values($1,true)",
    [profile],
  );
  await as(athlete);
  const v = (
    await db.query<{ asset_path: string }>(
      "select * from public.begin_athlete_video($1,$2,$3,'video/mp4',100,10)",
      [clip, profile, resource],
    )
  ).rows[0];
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,$2)",
    [v.asset_path, { size: 100, mimetype: "video/mp4" }],
  );
  await db.query("select public.finish_athlete_video($1)", [clip]);
  await as(coach);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toEqual([]);
  await as(parent);
  await db.query("select public.approve_athlete_video($1,2)", [clip]);
  await as(coach);
  expect(
    (await db.query("select status from public.athlete_video_reviews")).rows,
  ).toEqual([{ status: "queued" }]);
});
it("requires stored-video removal before a family deletes the record", async () => {
  const v = await uploaded();
  await expect(
    db.query("select public.delete_athlete_video($1)", [clip]),
  ).rejects.toThrow(/Remove the stored video/);
  void v;
});
it("records assigned practice with server-derived titles and does not accept demo drills", async () => {
  await grant();
  await as(parent);
  await db.query("select public.report_athlete_workout($1,$2,$3)", [
    uid(90),
    profile,
    [resource],
  ]);
  expect(
    (await db.query("select titles,minutes from public.athlete_workouts")).rows,
  ).toEqual([{ titles: ["Original test drill"], minutes: 3 }]);
});
it("rejects files above the server-enforced 40 MB limit", async () => {
  await grant();
  await as(parent);
  await expect(
    db.query(
      "select public.begin_athlete_video($1,$2,$3,'video/mp4',41943041,10)",
      [clip, profile, resource],
    ),
  ).rejects.toThrow(/40 MB/);
});
it("rejects a stored object whose byte size does not match the reserved upload", async () => {
  const v = await begin();
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,$2)",
    [v.asset_path, { size: 99, mimetype: "video/mp4" }],
  );
  await expect(
    db.query("select public.finish_athlete_video($1)", [clip]),
  ).rejects.toThrow(/complete upload/);
});
it("does not accept unassigned sample IDs as real practice", async () => {
  await grant();
  await as(parent);
  await expect(
    db.query("select public.report_athlete_workout($1,$2,$3)", [
      uid(91),
      profile,
      ["walk-the-line"],
    ]),
  ).rejects.toThrow(/does not match/);
});
it("prevents stale Owner access changes", async () => {
  await grant();
  await as(owner);
  await expect(
    db.query("select public.set_member_training_access($1,$2,false,null,0)", [
      parent,
      [resource],
    ]),
  ).rejects.toThrow(/Access changed/);
});
it("revokes pending upload completion when assigned training is removed", async () => {
  const v = await begin();
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,$2)",
    [v.asset_path, { size: 100, mimetype: "video/mp4" }],
  );
  await as(owner);
  await db.query("select public.set_member_training_access($1,$2,true,$3,1)", [
    parent,
    [],
    coach,
  ]);
  await as(parent);
  await expect(
    db.query("select public.finish_athlete_video($1)", [clip]),
  ).rejects.toThrow(/permission is unavailable/);
});
it("prevents profile cascades from orphaning stored clips", async () => {
  await uploaded();
  await expect(
    db.query("delete from public.player_profiles where id=$1", [profile]),
  ).rejects.toThrow(/Delete this athlete/);
});
it("allows a family to fully remove the object, review and then profile", async () => {
  const v = await uploaded();
  await db.query(
    "delete from storage.objects where bucket_id='athlete-review-videos' and name=$1",
    [v.asset_path],
  );
  await db.query("select public.delete_athlete_video($1)", [clip]);
  await db.query("delete from public.player_profiles where id=$1", [profile]);
  expect(
    (await db.query("select id from public.athlete_video_reviews")).rows,
  ).toEqual([]);
});
it("does not expose submitted videos to anonymous visitors", async () => {
  await uploaded();
  await as("", "anon");
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='athlete-review-videos'",
      )
    ).rows,
  ).toEqual([]);
});

it("removes deleted workout assignments so Owner access changes remain editable", async () => {
  await grant();
  await as(coach);
  await db.query("delete from public.training_resources where id=$1", [
    resource,
  ]);
  await as(owner);
  const access = (
    await db.query<{ resource_ids: string[]; version: number }>(
      "select resource_ids,version from public.member_training_access where account_id=$1",
      [parent],
    )
  ).rows[0];
  expect(access.resource_ids).toEqual([wrongAge]);
  expect(access.version).toBe(2);
  await db.query(
    "select public.set_member_training_access($1,$2,false,null,2)",
    [parent, []],
  );
});
it("removes a protected assignment when its workout becomes a public sample", async () => {
  await grant();
  await as(coach);
  await db.query(
    "update public.training_resources set visibility='public_sample' where id=$1",
    [resource],
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
    (
      await db.query<{ resource_ids: string[] }>(
        "select resource_ids from public.member_training_access",
      )
    ).rows[0].resource_ids,
  ).toEqual([wrongAge]);
});

it("backfills obsolete assignments without removing still-published protected workouts", async () => {
  await db.query(
    "insert into public.member_training_access(account_id,resource_ids) values($1,$2)",
    [parent, [resource, uid(99)]],
  );
  const migration = readFileSync(
    new URL("../backend/007-training-assignment-cleanup.sql", import.meta.url),
    "utf8",
  );
  const start = migration.indexOf(
    "update public.member_training_access a set resource_ids=array(",
  );
  await db.exec(
    migration.slice(start, migration.indexOf("notify pgrst", start)),
  );
  expect(
    (
      await db.query<{ resource_ids: string[] }>(
        "select resource_ids from public.member_training_access where account_id=$1",
        [parent],
      )
    ).rows[0].resource_ids,
  ).toEqual([resource]);
});
