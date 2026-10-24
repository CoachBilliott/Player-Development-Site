import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
let db: PGlite;
const uid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, manager, coach, otherCoach, parent, athlete, unverified] = [
  1, 2, 3, 4, 5, 6, 7,
].map(uid);
const resource = uid(20),
  otherResource = uid(21),
  published = uid(22),
  privatePlayer = uid(23);
const content = {
  sport: "football",
  title: "Fictional original paper practice",
  skill: "Coordination",
  ages: ["18+"],
  positions: [],
  levels: ["New to the game"],
  minutes: 3,
  equipment: "Paper",
  lesson: "Illustrative pending qualified review.",
  steps: ["Point to a shape."],
  cue: "Pause.",
  kind: "read",
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$ select string_to_array(path,'/') $$;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select on storage.objects to anon; grant select,insert,delete on storage.objects to authenticated;`);
  for (let n = 1; n <= 8; n++)
    await db.query("insert into auth.users values($1,$2,$3)", [
      uid(n),
      `fictional-${n}@example.test`,
      n === 7 ? null : new Date().toISOString(),
    ]);
  for (const file of ["001-shared-content.sql", "002-private-profiles.sql"])
    await db.exec(
      readFileSync(new URL("../backend/" + file, import.meta.url), "utf8"),
    );
  await db.exec(`insert into public.coach_members values('${owner}'),('${manager}'),('${coach}'),('${otherCoach}');
 insert into public.member_accounts(user_id,account_type) select id,case when id in ('${parent}','${uid(8)}') then 'parent' else 'adult' end from auth.users where id<>'${unverified}';`);
  await db.exec(
    readFileSync(
      new URL("../backend/003-account-levels.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    `update public.account_roles set role='owner' where user_id='${owner}';update public.account_roles set role='manager' where user_id='${manager}';update public.profile_settings set under18_enabled=true;`,
  );
  for (const [id, creator, status] of [
    [resource, coach, "draft"],
    [otherResource, otherCoach, "draft"],
    [published, otherCoach, "published"],
  ]) {
    const path = `${creator}/${id}/${id}.txt`;
    await db.query(
      "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values($1,$2,$3,$4,'text/plain','sample.txt',$5)",
      [id, creator, content, path, status],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('training-media',$1)",
      [path],
    );
  }
  await db.exec(
    `insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal,guardian_confirmed) values('${privatePlayer}','${parent}','Fictional family profile','8–12','Quarterback','New to the game','Footwork',true),('${uid(24)}','${uid(8)}','Other fictional family','8–12','Quarterback','New to the game','Footwork',true)`,
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
it("all five levels are preserved or migrated without granting staff from member setup", async () => {
  expect(
    (
      await db.query(
        "select role,count(*)::integer as n from public.account_roles group by role order by role",
      )
    ).rows,
  ).toEqual([
    { role: "athlete", n: 1 },
    { role: "coach", n: 2 },
    { role: "manager", n: 1 },
    { role: "owner", n: 1 },
    { role: "parent", n: 2 },
  ]);
});
it("anonymous visitors cannot read levels or invoke role administration", async () => {
  await as("", "anon");
  await expect(db.query("select * from public.account_roles")).rejects.toThrow(
    /permission denied/,
  );
});
for (const [name, user] of [
  ["Manager", manager],
  ["Coach", coach],
  ["Parent", parent],
  ["Athlete", athlete],
] as const) {
  it(`${name} cannot self-promote, assign roles or read the account directory`, async () => {
    await as(user);
    await db.exec("savepoint denied");
    await expect(
      db.query("select public.assign_account_role($1,'owner',1)", [user]),
    ).rejects.toThrow(/Only owners/);
    await db.exec("rollback to savepoint denied");
    await expect(
      db.query("select * from public.list_account_access('')"),
    ).rejects.toThrow(/Owner access/);
  });
  it(`${name} cannot read a different household's private profile`, async () => {
    await as(user);
    expect(
      (
        await db.query("select id from public.player_profiles where id=$1", [
          user === parent ? uid(24) : privatePlayer,
        ])
      ).rows,
    ).toEqual([]);
  });
}
it("Owner can assign each level to a verified adult and creates an audit record", async () => {
  await as(owner);
  for (const role of ["coach", "parent", "athlete", "manager", "owner"]) {
    const version = (
      await db.query<{ version: number }>(
        "select version from public.account_roles where user_id=$1",
        [owner],
      )
    ).rows[0].version;
    expect(version).toBe(2);
    const current = await db.query<{ version: number }>(
      "select version from public.list_account_access('fictional-2')",
    );
    await db.query("select public.assign_account_role($1,$2,$3)", [
      manager,
      role,
      current.rows[0].version,
    ]);
  }
  const audit = await db.query<{ new_role: string }>(
    "select new_role from public.account_role_audit where actor_id=$1 and target_id=$2 order by id",
    [owner, manager],
  );
  expect(audit.rows.map((r) => r.new_role)).toEqual([
    "coach",
    "parent",
    "athlete",
    "manager",
    "owner",
  ]);
});
it("even Owner cannot write role tables directly or alter the audit trail", async () => {
  await as(owner);
  await expect(
    db.query("update public.account_roles set role='owner' where user_id=$1", [
      athlete,
    ]),
  ).rejects.toThrow(/permission denied/);
});
it("Owner self-demotion is rejected so the only Owner cannot be locked out", async () => {
  await as(owner);
  await expect(
    db.query("select public.assign_account_role($1,'athlete',2)", [owner]),
  ).rejects.toThrow(/own Owner access/);
});
it("stale role changes do not overwrite a more recent assignment", async () => {
  await as(owner);
  await db.query("select public.assign_account_role($1,'coach',1)", [athlete]);
  await expect(
    db.query("select public.assign_account_role($1,'manager',1)", [athlete]),
  ).rejects.toThrow(/changed on another device/);
});
it("unverified or incomplete accounts cannot be promoted", async () => {
  await as(owner);
  await expect(
    db.query("select public.assign_account_role($1,'manager',0)", [unverified]),
  ).rejects.toThrow(/verify their email/);
});
it("Coaches only read their own drafts and cannot edit another coach content", async () => {
  await as(coach);
  expect(
    (
      await db.query<{ id: string }>(
        "select id from public.training_resources order by id",
      )
    ).rows,
  ).toEqual([{ id: resource }, { id: published }]);
  expect(
    (
      await db.query(
        "update public.training_resources set content=$1 where id=$2 returning id",
        [content, otherResource],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "delete from public.training_resources where id=$1 returning id",
        [published],
      )
    ).rows,
  ).toEqual([]);
});
for (const [name, user] of [
  ["Owner", owner],
  ["Manager", manager],
] as const) {
  it(`${name} manages content across coaches while private profiles remain isolated`, async () => {
    await as(user);
    expect(
      (await db.query("select id from public.training_resources")).rows,
    ).toHaveLength(3);
    expect(
      (
        await db.query(
          "update public.training_resources set content=$1 where id=$2 returning id",
          [content, otherResource],
        )
      ).rows,
    ).toEqual([{ id: otherResource }]);
    expect(
      (
        await db.query("select id from public.player_profiles where id=$1", [
          privatePlayer,
        ])
      ).rows,
    ).toEqual([]);
  });
}
it("Parent and Athlete cannot publish even if user metadata claims a staff role", async () => {
  await as(parent);
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ user_metadata: { role: "owner" } }),
  ]);
  expect(
    (await db.query("select public.current_account_role() as role")).rows,
  ).toEqual([{ role: "parent" }]);
  await expect(
    db.query(
      "insert into public.training_resources(id,content,asset_path,asset_type,asset_name) values($1,$2,$3,'text/plain','fake.txt')",
      [uid(50), content, `${parent}/${uid(50)}/${uid(50)}.txt`],
    ),
  ).rejects.toThrow(/row-level security/);
});
it("Athlete can create one own adult profile; repeated creation is rejected", async () => {
  await as(athlete);
  const sql =
    "insert into public.player_profiles(id,nickname,age_group,position,experience,goal) values($1,'Fictional adult','18+','Quarterback','New to the game','Footwork')";
  await db.query(sql, [uid(30)]);
  await expect(db.query(sql, [uid(31)])).rejects.toThrow(
    /one personal profile/,
  );
});
it("Parent retains multiple family profiles and cannot be changed to Athlete while a minor profile exists", async () => {
  await as(parent);
  await db.query(
    "insert into public.player_profiles(id,nickname,age_group,position,experience,goal,guardian_confirmed) values($1,'Fictional sibling','5–7','Quarterback','New to the game','Footwork',true)",
    [uid(32)],
  );
  await as(owner);
  await expect(
    db.query("select public.assign_account_role($1,'athlete',1)", [parent]),
  ).rejects.toThrow(/Keep Parent access/);
});
it("a removed Coach immediately loses write access and the legacy publishing allowlist is synchronized", async () => {
  await as(owner);
  await db.query("select public.assign_account_role($1,'parent',1)", [coach]);
  await as(coach);
  expect((await db.query("select * from public.coach_members")).rows).toEqual(
    [],
  );
  expect(
    (
      await db.query(
        "update public.training_resources set content=$1 where id=$2 returning id",
        [content, resource],
      )
    ).rows,
  ).toEqual([]);
});
it("Coach cannot delete another coach media; Manager can remove it", async () => {
  const path = `${otherCoach}/${otherResource}/${otherResource}.txt`;
  await as(coach);
  expect(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [path],
      )
    ).rows,
  ).toEqual([]);
  await as(manager);
  expect(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [path],
      )
    ).rows,
  ).toEqual([{ name: path }]);
});

it("repeated member setup cannot downgrade staff, remove publishing access or create phantom audit entries", async () => {
  await as(owner);
  const before = (
    await db.query<{ n: number }>(
      "select count(*)::integer as n from public.account_role_audit",
    )
  ).rows[0].n;
  await db.query("select public.complete_member_account('adult',true,true)");
  expect(
    (await db.query("select public.current_account_role() as role")).rows,
  ).toEqual([{ role: "owner" }]);
  expect(
    (await db.query("select user_id from public.coach_members")).rows,
  ).toEqual([{ user_id: owner }]);
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::integer as n from public.account_role_audit",
      )
    ).rows[0].n,
  ).toBe(before);
});

it("deleting profile data cannot be used to change an Owner-assigned Athlete level to Parent", async () => {
  await as(athlete);
  await db.query("select public.delete_member_data()");
  await expect(
    db.query("select public.complete_member_account('parent',true,true)"),
  ).rejects.toThrow(/account level is already set/);
});
