import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";

let db: PGlite;
const parent = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const unverified = "30000000-0000-4000-8000-000000000003";
const player = "40000000-0000-4000-8000-000000000004";
const adultPlayer = "50000000-0000-4000-8000-000000000005";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    insert into auth.users values ('${parent}',now()),('${other}',now()),('${unverified}',null);
  `);
  await db.exec(
    readFileSync(
      new URL("../backend/002-private-profiles.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`update public.profile_settings set under18_enabled=true; insert into public.member_accounts(user_id,account_type) values ('${parent}','parent'),('${other}','adult');
    insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal,guardian_confirmed)
      values ('${player}','${parent}','Fictional Comet','8–12','Quarterback','New to the game','Footwork',true),
             ('${adultPlayer}','${other}','Fictional Adult','18+','Wide receiver','Experienced','Ball skills',false);`);
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
it("anonymous users have no account or profile permissions", async () => {
  await as("", "anon");
  await expect(
    db.query("select * from public.player_profiles"),
  ).rejects.toThrow(/permission denied/);
});
it("members only read their own household; other members cannot read a known player ID", async () => {
  await as(other);
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([{ id: adultPlayer }]);
  expect(
    (
      await db.query("select * from public.player_profiles where id=$1", [
        player,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (await db.query("select user_id from public.member_accounts")).rows,
  ).toEqual([{ user_id: other }]);
});
it("other members cannot edit or delete another household's profile", async () => {
  await as(other);
  expect(
    (
      await db.query(
        "update public.player_profiles set nickname='Intruder' where id=$1 returning id",
        [player],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "delete from public.player_profiles where id=$1 returning id",
        [player],
      )
    ).rows,
  ).toEqual([]);
});
it("adult-player accounts cannot create under-18 profiles even with guardian_confirmed spoofed", async () => {
  await as(other);
  await expect(
    db.query(
      "insert into public.player_profiles(id,nickname,age_group,position,experience,goal,guardian_confirmed) values($1,'Fake','5–7','Quarterback','Experienced','Footwork',true)",
      [unverified],
    ),
  ).rejects.toThrow(/parent account/);
});
it("parents must explicitly confirm guardianship for under-18 profiles", async () => {
  await as(parent);
  await expect(
    db.query(
      "update public.player_profiles set guardian_confirmed=false where id=$1",
      [player],
    ),
  ).rejects.toThrow(/check constraint/);
});
it("verified adults can complete setup idempotently without granting coach/admin roles", async () => {
  await as(parent);
  const rows = (
    await db.query(
      "select (public.complete_member_account('parent',true,true)).user_id",
    )
  ).rows;
  expect(rows).toEqual([{ user_id: parent }]);
  await expect(
    db.query("select public.complete_member_account('admin',true,true)"),
  ).rejects.toThrow(/adult account/);
});
it("unverified email cannot create a member account", async () => {
  await as(unverified);
  await expect(
    db.query("select public.complete_member_account('parent',true,true)"),
  ).rejects.toThrow(/Verify your email/);
});
it("account type and consent records cannot be rewritten by browser users", async () => {
  await as(other);
  await expect(
    db.query(
      "update public.member_accounts set account_type='parent' where user_id=$1",
      [other],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("private ownership cannot be transferred to another account", async () => {
  await as(parent);
  await expect(
    db.query("update public.player_profiles set owner_id=$1 where id=$2", [
      other,
      player,
    ]),
  ).rejects.toThrow(/ownership/);
});
it("profile version conflicts do not overwrite changes made on a second device", async () => {
  await as(parent);
  expect(
    (
      await db.query(
        "update public.player_profiles set nickname='Fictional Updated' where id=$1 and version=1 returning version",
        [player],
      )
    ).rows,
  ).toEqual([{ version: 2 }]);
  expect(
    (
      await db.query(
        "update public.player_profiles set nickname='Stale' where id=$1 and version=1 returning id",
        [player],
      )
    ).rows,
  ).toEqual([]);
});
it("deleting member data cascades only that household's profiles, retaining other households and Auth login", async () => {
  await as(parent);
  await db.query("select public.delete_member_data()");
  expect((await db.query("select * from public.player_profiles")).rows).toEqual(
    [],
  );
  await db.exec("reset role");
  expect(
    (await db.query("select id from public.player_profiles")).rows,
  ).toEqual([{ id: adultPlayer }]);
  expect(
    (await db.query("select id from auth.users where id=$1", [parent])).rows,
  ).toEqual([{ id: parent }]);
});

it("under-18 enrollment stays closed at the server until the owner completes consent/privacy setup", async () => {
  await db.exec("update public.profile_settings set under18_enabled=false");
  await as(parent);
  await expect(
    db.query(
      "update public.player_profiles set nickname='Fictional update' where id=$1",
      [player],
    ),
  ).rejects.toThrow(/enrollment is not open/);
});
it("members cannot open under-18 enrollment from the browser", async () => {
  await as(parent);
  await expect(
    db.query("update public.profile_settings set under18_enabled=true"),
  ).rejects.toThrow(/permission denied/);
});
