import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("025 applies incrementally to a populated local fixture without changing installed-client RPCs, grants or existing records", async () => {
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
      .filter(
        (file) => /^\d{3}-.*\.sql$/.test(file) && Number(file.slice(0, 3)) < 25,
      )
      .sort();
    expect(files.filter((file) => Number(file.slice(0, 3)) <= 18)).toHaveLength(
      18,
    );
    expect(new Set(files.map((file) => file.slice(0, 3))).size).toBe(
      files.length,
    );
    for (const file of files)
      await db.exec(readFileSync(new URL(file, backend), "utf8"));
    // Only a fresh local test DB is bootstrapped above. Hosted test instructions
    // explicitly prohibit replaying base migrations on an existing project.
    const user = "d2000000-0000-4000-8000-000000000001";
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${user}','fictional-existing@example.test',now());
      insert into public.member_accounts(user_id,account_type) values('${user}','adult');
      insert into public.account_roles(user_id,role) values('${user}','owner');`);
    await db.exec(
      readFileSync(new URL("account-names-preflight.sql", backend), "utf8"),
    );
    const accountsBefore = (
      await db.query("select * from public.member_accounts")
    ).rows;
    const rolesBefore = (await db.query("select * from public.account_roles"))
      .rows;
    const snapshot = () =>
      db.query(
        "select proname,prosrc,proacl::text from pg_proc where pronamespace='public'::regnamespace order by proname,oid",
      );
    const before = (await snapshot()).rows;
    await db.exec(
      readFileSync(new URL("025-account-names.sql", backend), "utf8"),
    );
    const after = (await snapshot()).rows;
    for (const fn of before) expect(after).toContainEqual(fn);
    expect((await db.query("select * from public.account_names")).rows).toEqual(
      [],
    );
    expect((await db.query("select * from public.account_roles")).rows).toEqual(
      rolesBefore,
    );
    expect(
      (await db.query("select * from public.member_accounts")).rows,
    ).toEqual(accountsBefore);
    await db.exec(
      readFileSync(new URL("account-names-preflight.sql", backend), "utf8"),
    );
  } finally {
    await db.close();
  }
}, 30000);
