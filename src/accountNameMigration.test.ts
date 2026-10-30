import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("019 applies after the complete 001–018 chain and leaves installed-client RPC definitions and grants untouched", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated',created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      alter table storage.objects enable row level security;
      create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
      grant usage on schema public,auth,storage to anon,authenticated;
      grant select on storage.objects to anon; grant select,insert,delete on storage.objects to authenticated;`);
    const backend = new URL("../backend/", import.meta.url);
    const files = readdirSync(backend)
      .filter((file) => /^\d{3}-.*\.sql$/.test(file))
      .sort();
    expect(files).toHaveLength(19);
    for (const file of files.slice(0, 18))
      await db.exec(readFileSync(new URL(file, backend), "utf8"));
    const snapshot = () =>
      db.query(
        "select proname,prosrc,proacl::text from pg_proc where pronamespace='public'::regnamespace order by proname,oid",
      );
    const before = (await snapshot()).rows;
    await db.exec(
      readFileSync(new URL("019-account-names.sql", backend), "utf8"),
    );
    const after = (await snapshot()).rows;
    for (const fn of before) expect(after).toContainEqual(fn);
    expect((await db.query("select * from public.account_names")).rows).toEqual(
      [],
    );
    expect((await db.query("select * from public.account_roles")).rows).toEqual(
      [],
    );
  } finally {
    await db.close();
  }
}, 30000);
