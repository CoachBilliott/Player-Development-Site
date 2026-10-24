import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
let db: PGlite;
let legacyVisibility: string;
const uid = (n: number) =>
  `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1),
  manager = uid(2),
  coach = uid(3),
  otherCoach = uid(4),
  parent = uid(5),
  athlete = uid(6);
const publicId = uid(10),
  privateId = uid(11),
  otherId = uid(12),
  draftId = uid(13);
const content = {
  sport: "football",
  title: "Fictional sample resource",
  skill: "Footwork",
  ages: ["18+"],
  positions: [],
  levels: ["New to the game"],
  minutes: 3,
  equipment: "Clear flat space",
  lesson: "Illustrative only.",
  steps: ["Pause with a practice partner."],
  cue: "Take your time.",
  kind: "movement",
};
const path = (id: string, creator = coach) => `${creator}/${id}/${id}.txt`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  for (let n = 1; n <= 6; n++)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [uid(n), `fictional-view-${n}@example.test`],
    );
  for (const name of [
    "001-shared-content.sql",
    "002-private-profiles.sql",
    "003-account-levels.sql",
    "004-family-athletes.sql",
  ])
    await db.exec(
      readFileSync(new URL("../backend/" + name, import.meta.url), "utf8"),
    );
  for (const [id, role] of [
    [owner, "owner"],
    [manager, "manager"],
    [coach, "coach"],
    [otherCoach, "coach"],
    [parent, "parent"],
    [athlete, "athlete"],
  ])
    await db.query(
      "insert into public.account_roles(user_id,role) values($1,$2)",
      [id, role],
    );
  await db.query(
    "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values($1,$2,$3,$4,'text/plain','sample.txt','published')",
    [publicId, coach, content, path(publicId)],
  );
  await db.exec(
    readFileSync(
      new URL("../backend/005-content-audiences.sql", import.meta.url),
      "utf8",
    ),
  );
  legacyVisibility = (
    await db.query<{ visibility: string }>(
      "select visibility from public.training_resources where id=$1",
      [publicId],
    )
  ).rows[0].visibility;
  await db.query(
    "update public.training_resources set visibility='public_sample' where id=$1",
    [publicId],
  );
  for (const [id, creator, status] of [
    [privateId, coach, "published"],
    [otherId, otherCoach, "published"],
    [draftId, coach, "draft"],
  ])
    await db.query(
      "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values($1,$2,$3,$4,'text/plain','sample.txt',$5)",
      [id, creator, content, path(id, creator), status],
    );
  for (const [id, creator] of [
    [publicId, coach],
    [privateId, coach],
    [otherId, otherCoach],
    [draftId, coach],
  ])
    await db.query(
      "insert into storage.objects(bucket_id,name) values('training-media',$1)",
      [path(id, creator)],
    );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function ids() {
  return (
    await db.query<{ id: string }>(
      "select id from public.training_resources order by id",
    )
  ).rows.map((r) => r.id);
}
it("protects existing uploads and defaults new content to protected; public samples require an explicit choice", async () => {
  expect(legacyVisibility).toBe("member_only");
  expect(
    (
      await db.query(
        "select visibility from public.training_resources where id=$1",
        [publicId],
      )
    ).rows,
  ).toEqual([{ visibility: "public_sample" }]);
  expect(
    (
      await db.query(
        "select visibility from public.training_resources where id=$1",
        [privateId],
      )
    ).rows,
  ).toEqual([{ visibility: "member_only" }]);
});
it("anonymous REST and media reads expose only public published samples, including known private IDs", async () => {
  await as("", "anon");
  expect(await ids()).toEqual([publicId]);
  expect(
    (
      await db.query("select id from public.training_resources where id=$1", [
        privateId,
      ])
    ).rows,
  ).toEqual([]);
  expect((await db.query("select name from storage.objects")).rows).toEqual([
    { name: path(publicId) },
  ]);
});
it.each([parent, athlete])(
  "unpaid member %s cannot read protected metadata or sign protected media",
  async (user) => {
    await as(user);
    expect(await ids()).toEqual([publicId]);
    expect(
      (
        await db.query("select name from storage.objects where name=$1", [
          path(privateId),
        ])
      ).rows,
    ).toEqual([]);
  },
);
it.each([owner, manager])(
  "authorized staff %s can review protected content and media across coaches",
  async (user) => {
    await as(user);
    expect(await ids()).toHaveLength(4);
    expect(
      (await db.query("select name from storage.objects")).rows,
    ).toHaveLength(4);
  },
);
it("coaches read their protected content but not another coach’s protected content or media", async () => {
  await as(coach);
  expect(await ids()).toEqual([publicId, privateId, draftId]);
  expect(
    (
      await db.query("select name from storage.objects where name=$1", [
        path(otherId, otherCoach),
      ])
    ).rows,
  ).toEqual([]);
});
it("nonstaff cannot publish protected resources, change visibility or grant themselves staff", async () => {
  await as(parent);
  expect(
    (
      await db.query(
        "update public.training_resources set visibility='public_sample' where id=$1 returning id",
        [privateId],
      )
    ).rows,
  ).toEqual([]);
  await expect(
    db.query(
      "insert into public.training_resources(id,content,asset_path,asset_type,asset_name) values($1,$2,$3,'text/plain','sample.txt')",
      [uid(20), content, path(uid(20), parent)],
    ),
  ).rejects.toThrow(/row-level security/);
});
it("explicit staff publication makes a public sample available and re-protection hides metadata and future signing", async () => {
  await as(coach);
  await db.query(
    "update public.training_resources set visibility='public_sample' where id=$1",
    [privateId],
  );
  await as("", "anon");
  expect(await ids()).toEqual([publicId, privateId]);
  await as(coach);
  await db.query(
    "update public.training_resources set visibility='member_only' where id=$1",
    [privateId],
  );
  await as("", "anon");
  expect(await ids()).toEqual([publicId]);
  expect(
    (
      await db.query("select name from storage.objects where name=$1", [
        path(privateId),
      ])
    ).rows,
  ).toEqual([]);
});
it("cannot broaden access by inventing a visibility value", async () => {
  await as(owner);
  await expect(
    db.query(
      "update public.training_resources set visibility='paid-but-open' where id=$1",
      [privateId],
    ),
  ).rejects.toThrow(/check constraint/);
});
