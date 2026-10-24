import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { DRILLS } from "./data";
let db: PGlite;
const uid = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const parent = uid(1),
  adult = uid(2),
  child = uid(3),
  otherParent = uid(4),
  staff = uid(5),
  unverified = uid(6);
const adultProfile = uid(10),
  childProfile = uid(11),
  sibling = uid(12),
  otherFamily = uid(13),
  solo = uid(14),
  workout = uid(20);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$ select string_to_array(path,'/') $$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  for (let n = 1; n <= 6; n++)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
      [
        uid(n),
        `fictional-family-${n}@example.test`,
        n === 6 ? null : new Date().toISOString(),
      ],
    );
  for (const file of [
    "001-shared-content.sql",
    "002-private-profiles.sql",
    "003-account-levels.sql",
    "004-family-athletes.sql",
  ])
    await db.exec(
      readFileSync(new URL("../backend/" + file, import.meta.url), "utf8"),
    );
  await db.exec(`insert into public.member_accounts(user_id,account_type) values('${parent}','parent'),('${adult}','adult'),('${otherParent}','parent'),('${staff}','adult');
 insert into public.account_roles(user_id,role) values('${parent}','parent'),('${adult}','athlete'),('${otherParent}','parent'),('${staff}','owner');
 update public.profile_settings set under18_enabled=true;`);
  for (const [id, owner, age] of [
    [adultProfile, parent, "18+"],
    [childProfile, parent, "8–12"],
    [sibling, parent, "13–17"],
    [otherFamily, otherParent, "18+"],
  ])
    await db.query(
      "insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal,guardian_confirmed) values($1,$2,'Fictional family athlete',$3,'Quarterback','New to the game','Footwork',true)",
      [id, owner, age],
    );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(user: string, role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function invite(profile = adultProfile) {
  await as(parent);
  await db.query("select public.set_athlete_permission($1,true,0)", [profile]);
  return (
    await db.query<{ code: string }>(
      "select public.create_athlete_invite($1) as code",
      [profile],
    )
  ).rows[0].code;
}
async function connect() {
  const code = await invite();
  await as(adult);
  await db.query("select public.accept_athlete_invite($1)", [code]);
  return code;
}
async function report(id = workout, profile = adultProfile) {
  return db.query<{ status: string; minutes: number }>(
    "select (w).status,(w).minutes from (select public.report_athlete_workout($1,$2,array['ready-reset']) as w) s",
    [id, profile],
  );
}
it("the server catalog matches the original sample drill metadata", async () => {
  const rows = await db.query<{
    id: string;
    title: string;
    minutes: number;
    ages: string[];
    positions: string[];
    levels: string[];
  }>("select * from public.practice_catalog order by id");
  expect(rows.rows).toEqual(
    DRILLS.map((d) => ({
      id: d.id,
      title: d.title,
      minutes: d.minutes,
      ages: d.ages,
      positions: d.positions,
      levels: d.levels,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  );
});
it("a family athlete is one individual profile and can read neither siblings nor other families", async () => {
  await connect();
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([{ id: adultProfile }]);
  await expect(
    db.query("select public.family_profile_state($1)", [sibling]),
  ).rejects.toThrow(/not available/);
});
it("a parent controls each athlete independently and stale changes do not overwrite permission", async () => {
  await as(parent);
  await db.query("select public.set_athlete_permission($1,true,0)", [
    adultProfile,
  ]);
  expect(
    (
      await db.query<{ value: boolean }>(
        "select (public.family_profile_state($1)->>'self_recording_allowed')::boolean as value",
        [childProfile],
      )
    ).rows,
  ).toEqual([{ value: false }]);
  await expect(
    db.query("select public.set_athlete_permission($1,false,0)", [
      adultProfile,
    ]),
  ).rejects.toThrow(/Permission changed/);
});
it("child self-access remains blocked despite a parent permission until trusted consent and gates exist", async () => {
  await as(parent);
  await db.query("select public.set_athlete_permission($1,true,0)", [
    childProfile,
  ]);
  await expect(
    db.query("select public.create_athlete_invite($1)", [childProfile]),
  ).rejects.toThrow(/consent review/);
});
it("parents cannot write their own verified-consent records or forge a child-access gate", async () => {
  await as(parent);
  await expect(
    db.query(
      "insert into public.guardian_access_reviews values($1,now(),'self-certified')",
      [childProfile],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("a linked athlete cannot change permission, approve their own workout or edit the parent profile", async () => {
  await connect();
  await report();
  await db.exec("savepoint attempt");
  await expect(
    db.query("select public.set_athlete_permission($1,true,1)", [adultProfile]),
  ).rejects.toThrow(/Only this athlete/);
  await db.exec("rollback to savepoint attempt");
  await db.exec("savepoint review");
  await expect(
    db.query("select public.review_athlete_workout($1,'approved',1)", [
      workout,
    ]),
  ).rejects.toThrow(/Only this athlete/);
  await db.exec("rollback to savepoint review");
  expect(
    (
      await db.query(
        "update public.player_profiles set nickname='Changed' where id=$1 returning id",
        [adultProfile],
      )
    ).rows,
  ).toEqual([]);
});
it("athlete submissions await parent review and repeated completion is idempotent", async () => {
  await connect();
  expect((await report()).rows).toEqual([
    { status: "pending_parent", minutes: 4 },
  ]);
  await report();
  expect(
    (await db.query("select id from public.athlete_workouts")).rows,
  ).toEqual([{ id: workout }]);
  await as(parent);
  await db.query("select public.review_athlete_workout($1,'approved',1)", [
    workout,
  ]);
  expect(
    (
      await db.query(
        "select status,version from public.athlete_workouts where id=$1",
        [workout],
      )
    ).rows,
  ).toEqual([{ status: "approved", version: 2 }]);
  await expect(
    db.query("select public.review_athlete_workout($1,'needs_repeat',1)", [
      workout,
    ]),
  ).rejects.toThrow(/already reviewed/);
});
it("asking for another practice keeps the original submission and permits a new report", async () => {
  await connect();
  await report();
  await as(parent);
  await db.query("select public.review_athlete_workout($1,'needs_repeat',1)", [
    workout,
  ]);
  await as(adult);
  await report(uid(21));
  expect(
    (await db.query("select status from public.athlete_workouts order by id"))
      .rows,
  ).toEqual([{ status: "needs_repeat" }, { status: "pending_parent" }]);
});
it("turning permission off immediately blocks submissions while retaining readable history", async () => {
  await connect();
  await report();
  await as(parent);
  await db.query("select public.set_athlete_permission($1,false,1)", [
    adultProfile,
  ]);
  await as(adult);
  expect(
    (await db.query("select id from public.athlete_workouts")).rows,
  ).toEqual([{ id: workout }]);
  await expect(report(uid(21))).rejects.toThrow(/paused independent/);
});
it("removing the family connection revokes profile and history visibility", async () => {
  await connect();
  await report();
  await as(parent);
  await db.query("select public.remove_athlete_access($1)", [adultProfile]);
  await as(adult);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select id from public.athlete_workouts")).rows,
  ).toEqual([]);
});
it("the parent can still record approved practice when athlete self-recording is off", async () => {
  await as(parent);
  expect((await report()).rows).toEqual([{ status: "approved", minutes: 4 }]);
});
it("a standalone athlete keeps one own profile with self-reported practice and no invented parent approval", async () => {
  await as(adult);
  await db.query(
    "insert into public.player_profiles(id,nickname,age_group,position,experience,goal) values($1,'Fictional individual','18+','Quarterback','New to the game','Footwork')",
    [solo],
  );
  expect((await report(workout, solo)).rows).toEqual([
    { status: "self_reported", minutes: 4 },
  ]);
  await expect(
    db.query("select public.review_athlete_workout($1,'approved',1)", [
      workout,
    ]),
  ).rejects.toThrow(/Only this athlete/);
});
it("a linked athlete cannot create a second individual profile", async () => {
  await connect();
  await expect(
    db.query(
      "insert into public.player_profiles(id,nickname,age_group,position,experience,goal) values($1,'Duplicate','18+','Quarterback','New to the game','Footwork')",
      [solo],
    ),
  ).rejects.toThrow(/already belongs/);
});
it("access codes are single use and not readable as a browser table", async () => {
  const code = await connect();
  await db.exec("savepoint reused");
  await expect(
    db.query("select public.accept_athlete_invite($1)", [code]),
  ).rejects.toThrow(/unavailable or expired/);
  await db.exec("rollback to savepoint reused");
  await expect(
    db.query("select * from public.family_athlete_invites"),
  ).rejects.toThrow(/permission denied/);
});
it("expired invitations are rejected", async () => {
  const code = await invite();
  await db.exec("reset role");
  await db.query(
    "update public.family_athlete_invites set expires_at=now()-interval '1 hour'",
  );
  await as(adult);
  await expect(
    db.query("select public.accept_athlete_invite($1)", [code]),
  ).rejects.toThrow(/expired/);
});
it("anonymous visitors cannot read workouts or claim an access code", async () => {
  await as("", "anon");
  await expect(
    db.query("select * from public.athlete_workouts"),
  ).rejects.toThrow(/permission denied/);
});
it("other households and staff Owners have no implicit permission to see or approve family workouts", async () => {
  await connect();
  await report();
  await as(staff);
  expect(
    (await db.query("select id from public.athlete_workouts")).rows,
  ).toEqual([]);
  await expect(
    db.query("select public.review_athlete_workout($1,'approved',1)", [
      workout,
    ]),
  ).rejects.toThrow(/Only this athlete/);
});
it("the server rejects forged completion metadata and age-inappropriate sessions", async () => {
  await connect();
  await db.exec("savepoint forged");
  await expect(
    db.query(
      "insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status) values($1,$2,$3,array['ready-reset'],array['Forged'],60,'approved')",
      [workout, adultProfile, adult],
    ),
  ).rejects.toThrow(/permission denied/);
  await db.exec("rollback to savepoint forged");
  await expect(
    db.query(
      "select public.report_athlete_workout($1,$2,array['little-steps'])",
      [workout, adultProfile],
    ),
  ).rejects.toThrow(/does not match/);
});
it("a minor connection requires trusted consent and cannot escape parent management after revocation", async () => {
  await db.exec(
    "update public.profile_settings set child_self_access_enabled=true",
  );
  await db.query(
    "insert into public.guardian_access_reviews values($1,now(),'FICTIONAL TEST REVIEW ONLY')",
    [childProfile],
  );
  const code = await invite(childProfile);
  await as(child);
  await db.query("select public.accept_athlete_invite($1)", [code]);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([{ id: childProfile }]);
  await as(parent);
  await db.query("select public.remove_athlete_access($1)", [childProfile]);
  await as(child);
  await db.exec("savepoint escape");
  await expect(
    db.query("select public.complete_member_account('adult',true,true)"),
  ).rejects.toThrow(/remains parent-managed/);
  await db.exec("rollback to savepoint escape");
  await expect(
    db.query(
      "select public.complete_member_account_adult_base('adult',true,true)",
    ),
  ).rejects.toThrow(/permission denied/);
});

it("unverified accounts cannot claim a private family access code", async () => {
  const code = await invite();
  await as(unverified);
  await expect(
    db.query("select public.accept_athlete_invite($1)", [code]),
  ).rejects.toThrow(/Verify your email/);
});

it("turning permission off revokes unused invitations and prevents a later claim", async () => {
  const code = await invite();
  await as(parent);
  await db.query("select public.set_athlete_permission($1,false,1)", [
    adultProfile,
  ]);
  await as(adult);
  await expect(
    db.query("select public.accept_athlete_invite($1)", [code]),
  ).rejects.toThrow(/unavailable or expired/);
});
it("a parent cannot create another invite over an existing athlete connection", async () => {
  await connect();
  await as(parent);
  await expect(
    db.query("select public.create_athlete_invite($1)", [adultProfile]),
  ).rejects.toThrow(/existing athlete connection/);
});
it("parent revocation remains available if child enrollment is paused", async () => {
  await db.exec(
    "update public.profile_settings set child_self_access_enabled=true",
  );
  await db.query(
    "insert into public.guardian_access_reviews values($1,now(),'FICTIONAL TEST REVIEW')",
    [childProfile],
  );
  const code = await invite(childProfile);
  await as(child);
  await db.query("select public.accept_athlete_invite($1)", [code]);
  await db.exec("reset role");
  await db.exec("update public.profile_settings set under18_enabled=false");
  await as(parent);
  await db.query("select public.set_athlete_permission($1,false,1)", [
    childProfile,
  ]);
  await db.query("select public.remove_athlete_access($1)", [childProfile]);
  await as(child);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([]);
});
it("even an Owner cannot promote a connected athlete to staff or use the revoked base RPC", async () => {
  await connect();
  await as(staff);
  await db.exec("savepoint promote");
  await expect(
    db.query("select public.assign_account_role($1,'coach',1)", [adult]),
  ).rejects.toThrow(/family-linked athlete/);
  await db.exec("rollback to savepoint promote");
  await expect(
    db.query("select public.assign_adult_account_role_base($1,'coach',1)", [
      adult,
    ]),
  ).rejects.toThrow(/permission denied/);
});

it("changing a known minor profile to an adult age band cannot bypass child consent gates", async () => {
  await as(parent);
  await db.query(
    "update public.player_profiles set age_group='18+' where id=$1",
    [childProfile],
  );
  await db.query("select public.set_athlete_permission($1,true,0)", [
    childProfile,
  ]);
  await expect(
    db.query("select public.create_athlete_invite($1)", [childProfile]),
  ).rejects.toThrow(/consent review/);
});
