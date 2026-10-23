import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";

// Real PostgreSQL RLS execution in WASM, with minimal Auth/Storage schema fixtures.
// This does not replace testing Supabase Auth and Storage APIs in the eventual project.
let db: PGlite;
const coach = "10000000-0000-4000-8000-000000000001";
const outsider = "20000000-0000-4000-8000-000000000002";
const id = "30000000-0000-4000-8000-000000000003";
const draftId = "40000000-0000-4000-8000-000000000004";
const asset = `${coach}/${id}/${id}.txt`;
const content = {
  sport: "football",
  title: "Original paper exercise",
  skill: "Coordination",
  ages: ["5–7"],
  levels: ["New to the game"],
  positions: [],
  minutes: 3,
  steps: ["Point to a shape with an adult."],
  equipment: "Paper",
  lesson: "Illustrative, pending review.",
  cue: "Pause when needed.",
  kind: "read",
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(path text) returns text[] language sql immutable as $$ select string_to_array(path, '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select on storage.objects to anon;
    grant select,insert,delete on storage.objects to authenticated;
    insert into auth.users values ('${coach}'),('${outsider}');
  `);
  await db.exec(
    readFileSync(
      new URL("../backend/001-shared-content.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`insert into public.coach_members values ('${coach}')`);
  for (const [resourceId, status] of [
    [id, "published"],
    [draftId, "draft"],
  ]) {
    await db.query(
      "insert into public.training_resources(id,created_by,content,asset_path,asset_type,asset_name,status) values ($1,$2,$3,$4,'text/plain','original.txt',$5)",
      [
        resourceId,
        coach,
        content,
        `${coach}/${resourceId}/${resourceId}.txt`,
        status,
      ],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('training-media',$1)",
      [`${coach}/${resourceId}/${resourceId}.txt`],
    );
  }
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(role: "anon" | "authenticated", user = "") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
it("anonymous visitors read only published resources and their media", async () => {
  await as("anon");
  expect(
    (await db.query("select id from public.training_resources")).rows,
  ).toEqual([{ id }]);
  expect((await db.query("select name from storage.objects")).rows).toEqual([
    { name: asset },
  ]);
});
it("anonymous visitors cannot write resources", async () => {
  await as("anon");
  await expect(
    db.query("delete from public.training_resources where id=$1", [id]),
  ).rejects.toThrow(/permission denied/);
});
it("a signed-in non-coach cannot publish or read coach-only drafts", async () => {
  await as("authenticated", outsider);
  expect(
    (await db.query("select id from public.training_resources")).rows,
  ).toEqual([{ id }]);
  await expect(
    db.query(
      "insert into public.training_resources(id,content,asset_path,asset_type,asset_name,status) values ($1,$2,$3,'text/plain','new.txt','published')",
      [outsider, content, `${outsider}/${outsider}/${outsider}.txt`],
    ),
  ).rejects.toThrow(/row-level security/);
});
it("even an approved coach cannot grant coach access through the browser role", async () => {
  await as("authenticated", coach);
  await expect(
    db.query("insert into public.coach_members values ($1)", [outsider]),
  ).rejects.toThrow(/permission denied/);
});
it("approved coaches edit content with a server-incremented version", async () => {
  await as("authenticated", coach);
  const changed = await db.query(
    "update public.training_resources set content=$1 where id=$2 and version=1 returning version",
    [{ ...content, title: "Updated original exercise" }, id],
  );
  expect(changed.rows).toEqual([{ version: 2 }]);
  expect(
    (
      await db.query(
        "update public.training_resources set content=$1 where id=$2 and version=1 returning id",
        [content, id],
      )
    ).rows,
  ).toEqual([]);
});
it("server validation rejects invalid training audiences", async () => {
  await as("authenticated", coach);
  await expect(
    db.query("update public.training_resources set content=$1 where id=$2", [
      { ...content, ages: ["invalid-age"] },
      id,
    ]),
  ).rejects.toThrow(/check constraint/);
});
it("approved coaches cannot upload objects under someone else’s folder", async () => {
  await as("authenticated", coach);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values ('training-media',$1)",
      [`${outsider}/${id}/${id}.txt`],
    ),
  ).rejects.toThrow(/row-level security/);
});
it("approved coaches upload and remove their sample media", async () => {
  await as("authenticated", coach);
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('training-media',$1)",
    [`${coach}/new.txt`],
  );
  expect(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [`${coach}/new.txt`],
      )
    ).rows,
  ).toHaveLength(1);
});
