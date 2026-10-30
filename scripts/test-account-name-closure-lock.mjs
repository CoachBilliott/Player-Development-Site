// Optional local integration test. Requires the managed local Docker daemon.
// No host ports, external database, production credentials or real accounts.
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const image =
  "postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = `repformed-account-name-lock-${process.pid}`;
const env = { ...process.env };
// Always use this environment's local daemon, preserving registry/proxy setup.
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
function docker(args) {
  const child = spawn(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    { env, stdio: ["pipe", "pipe", "pipe"] },
  );
  let out = "",
    err = "";
  child.stdout.on("data", (data) => {
    out += data;
  });
  child.stderr.on("data", (data) => {
    err += data;
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(err || out || `docker exited ${code}`)),
    );
  });
  // Keep a pending blocked statement from becoming an unhandled rejection.
  void done.catch(() => {});
  return { child, done, output: () => out };
}
async function command(args) {
  const job = docker(args);
  job.child.stdin.end();
  return job.done;
}
function session(app) {
  return docker([
    "exec",
    "-i",
    "-e",
    `PGAPPNAME=${app}`,
    container,
    "psql",
    "-XqAt",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ]);
}
async function sql(text) {
  const job = session("account-name-lock-control");
  job.child.stdin.end(text);
  return job.done;
}
async function until(check, description) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(40);
  }
  throw new Error(`Timed out waiting for ${description}`);
}
async function marker(job, text, label) {
  job.child.stdin.write(`${text}\n\\echo ${label}\n`);
  await until(() => job.output().includes(label), label);
}
async function finish(job) {
  job.child.stdin.end("commit;\n");
  return job.done;
}
async function waitingOnAdvisory(app) {
  await until(
    async () =>
      (
        await sql(
          `select count(*) from pg_stat_activity where application_name='${app}' and wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0;`,
        )
      ).trim() === "1",
    `${app} to block on lifecycle advisory lock`,
  );
}
const uid = (n) => `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const auth = (user) =>
  `set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`;
const start = (user) =>
  `select public.begin_account_closure('${user}','${uid(Number(user.slice(-2)) + 20)}');`;
const save = (user, version = 0) =>
  `select public.save_my_account_name('Fictional concurrent adult',${version},'${user}');`;
let started = false;
try {
  await command([
    "run",
    "-d",
    "--name",
    container,
    "--network",
    "none",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    image,
  ]);
  started = true;
  await until(async () => {
    try {
      await command([
        "exec",
        container,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]);
      return true;
    } catch {
      return false;
    }
  }, "temporary PostgreSQL readiness");
  await sql(`create role anon; create role authenticated; create role service_role bypassrls;
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
  assert.equal(
    files.filter((file) => Number(file.slice(0, 3)) <= 18).length,
    18,
  );
  for (const file of files)
    await sql(readFileSync(new URL(file, backend), "utf8"));
  for (const user of [uid(1), uid(2)])
    await sql(
      `insert into auth.users(id,email,email_confirmed_at) values('${user}','fictional-${user}@example.test',now()); insert into public.member_accounts(user_id,account_type) values('${user}','adult'); insert into public.account_roles(user_id,role) values('${user}','athlete');`,
    );

  // Apply only the new delta after the existing synthetic accounts are populated.
  await sql(readFileSync(new URL("025-account-names.sql", backend), "utf8"));

  // Closure holds the shared lock; the name writer must wait BEFORE locking
  // member_accounts. Once closure commits, a fresh eligibility read must deny it.
  const closure = session("closure-first-holder");
  await marker(
    closure,
    `begin; set local idle_in_transaction_session_timeout='20s'; set local role service_role; ${start(uid(1))}`,
    "CLOSURE_STARTED",
  );
  const lateSave = session("closure-first-name-writer");
  lateSave.child.stdin.end(
    `begin; set local statement_timeout='10s'; ${auth(uid(1))} ${save(uid(1))} commit;`,
  );
  await waitingOnAdvisory("closure-first-name-writer");
  assert.equal(
    (
      await sql(
        "select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='closure-first-name-writer' and l.relation='public.member_accounts'::regclass and l.granted;",
      )
    ).trim(),
    "0",
    "name save must take lifecycle lock before member row locks",
  );
  await finish(closure);
  await assert.rejects(lateSave.done, /Verified adult setup/);
  assert.equal(
    (
      await sql(
        `select count(*) from public.account_names where user_id='${uid(1)}';`,
      )
    ).trim(),
    "0",
  );
  assert.equal(
    (
      await sql(
        `select state from public.account_closures where user_id='${uid(1)}';`,
      )
    ).trim(),
    "cleaning",
  );
  console.log(
    "PASS closure-first: blocked on advisory lock, then denied after closure commit; no name inserted",
  );

  // Reverse ordering: an in-flight save completes before closure can start.
  // Cleanup then cascades that name away without reversing lock order.
  const writer = session("name-first-holder");
  await marker(
    writer,
    `begin; set local idle_in_transaction_session_timeout='20s'; ${auth(uid(2))} ${save(uid(2))}`,
    "NAME_SAVED",
  );
  const followingClosure = session("name-first-closure-writer");
  followingClosure.child.stdin.end(
    `begin; set local statement_timeout='10s'; set local role service_role; ${start(uid(2))} commit;`,
  );
  await waitingOnAdvisory("name-first-closure-writer");
  await finish(writer);
  await followingClosure.done;
  assert.equal(
    (
      await sql(
        `select version from public.account_names where user_id='${uid(2)}';`,
      )
    ).trim(),
    "1",
  );
  await assert.rejects(
    sql(`begin; ${auth(uid(2))} ${save(uid(2), 1)} commit;`),
    /Verified adult setup/,
  );
  await sql(
    `begin; set local role service_role; select public.clear_account_closure_data('${uid(2)}','${uid(22)}'); commit;`,
  );
  assert.equal(
    (
      await sql(
        `select count(*) from public.account_names where user_id='${uid(2)}';`,
      )
    ).trim(),
    "0",
  );
  assert.equal(
    (
      await sql(
        `select role from public.account_roles where user_id='${uid(2)}';`,
      )
    ).trim(),
    "athlete",
  );
  console.log(
    "PASS name-first: save commits before closure, later writes denied, cleanup cascades name; role unchanged",
  );

  // Missing-consent staff are pre-existing verified identities with legacy
  // admission. These are synthetic fixture rows, never hosted account backfill.
  for (const [n, role] of [
    [3, "owner"],
    [4, "manager"],
    [5, "coach"],
    [6, "owner"],
    [7, "owner"],
  ]) {
    await sql(
      `insert into auth.users(id,email,email_confirmed_at,created_at) values('${uid(n)}','fictional-staff-${n}@example.test',now(),(select legacy_before-interval '1 second' from public.account_onboarding_settings));insert into public.account_roles(user_id,role) values('${uid(n)}','${role}');`,
    );
  }
  await sql(
    `insert into public.member_accounts(user_id,account_type) values('${uid(7)}','adult');`,
  );
  const staffSetup = (user, version = 1) =>
    `select public.complete_my_staff_account_setup('${user}',${version},true,true,'adult-pilot-lifecycle-2026-10');`;

  const staffClosing = session("staff-setup-closing-holder");
  await marker(
    staffClosing,
    `begin;select pg_advisory_xact_lock(hashtextextended('${uid(3)}',1011));insert into public.account_closures(id,user_id,state) values('${uid(23)}','${uid(3)}','cleaning');`,
    "STAFF_CLOSURE_MARKED",
  );
  const deniedSetup = session("staff-setup-closing-writer");
  deniedSetup.child.stdin.end(
    `begin;set local statement_timeout='10s';${auth(uid(3))}${staffSetup(uid(3))}commit;`,
  );
  await waitingOnAdvisory("staff-setup-closing-writer");
  assert.equal(
    (
      await sql(
        "select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='staff-setup-closing-writer' and l.relation='public.member_accounts'::regclass and l.granted;",
      )
    ).trim(),
    "0",
  );
  await finish(staffClosing);
  await assert.rejects(deniedSetup.done, /Verified staff access/);
  assert.equal(
    (
      await sql(
        `select count(*) from public.member_accounts where user_id='${uid(3)}';`,
      )
    ).trim(),
    "0",
  );
  console.log(
    "PASS staff setup closure-first: waits before member locks, then denies without recording consent",
  );

  // Pause the old setup between its member INSERT and role-trigger lock.
  // The new wrapper must fail NOWAIT, releasing its lifecycle lock, rather
  // than deadlocking against that existing opposite-order primitive.
  const legacy = session("legacy-member-before-role-trigger");
  await marker(
    legacy,
    `begin;insert into public.member_accounts(user_id,account_type) values('${uid(4)}','adult');`,
    "LEGACY_MEMBER_INSERTED",
  );
  const startedAt = Date.now();
  await assert.rejects(
    sql(
      `begin;set local statement_timeout='5s';${auth(uid(4))}${staffSetup(uid(4))}commit;`,
    ),
    /could not obtain lock on relation/,
  );
  assert(
    Date.now() - startedAt < 5000,
    "legacy conflict must fail fast rather than deadlock",
  );
  await marker(
    legacy,
    `${auth(uid(4))}select public.complete_member_account('adult',true,true);`,
    "LEGACY_SETUP_FINISHED",
  );
  await finish(legacy);
  const legacyConsent = JSON.parse(
    (
      await sql(
        `select to_jsonb(a) from public.member_accounts a where user_id='${uid(4)}';`,
      )
    ).trim(),
  );
  await sql(`begin;${auth(uid(4))}${staffSetup(uid(4))}commit;`);
  assert.deepEqual(
    JSON.parse(
      (
        await sql(
          `select to_jsonb(a) from public.member_accounts a where user_id='${uid(4)}';`,
        )
      ).trim(),
    ),
    legacyConsent,
  );
  console.log(
    "PASS legacy setup collision: NOWAIT avoids the lock-order cycle; retry preserves existing consent",
  );

  const firstSetup = session("first-staff-setup");
  await marker(
    firstSetup,
    `begin;${auth(uid(5))}${staffSetup(uid(5))}select to_jsonb(a) from public.member_accounts a where user_id='${uid(5)}';`,
    "FIRST_STAFF_SETUP",
  );
  const firstConsent = firstSetup
    .output()
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line))
    .find((row) => row.user_id === uid(5));
  assert(firstConsent);
  const repeatedSetup = session("repeated-staff-setup");
  repeatedSetup.child.stdin.end(
    `begin;set local statement_timeout='10s';${auth(uid(5))}${staffSetup(uid(5))}commit;`,
  );
  await waitingOnAdvisory("repeated-staff-setup");
  await finish(firstSetup);
  await repeatedSetup.done;
  assert.deepEqual(
    JSON.parse(
      (
        await sql(
          `select to_jsonb(a) from public.member_accounts a where user_id='${uid(5)}';`,
        )
      ).trim(),
    ),
    firstConsent,
  );
  assert.equal(
    (
      await sql(
        `select role||':'||version from public.account_roles where user_id='${uid(5)}';`,
      )
    ).trim(),
    "coach:1",
  );
  console.log(
    "PASS concurrent repeated staff acceptance: one consent record, unchanged timestamps/version and exact Coach role",
  );

  const setupBeforeRole = session("staff-setup-before-role-change");
  await marker(
    setupBeforeRole,
    `begin;${auth(uid(6))}${staffSetup(uid(6))}`,
    "STAFF_SETUP_ROLE_PRESERVED",
  );
  const roleChange = session("approved-role-change-after-staff-setup");
  roleChange.child.stdin.end(
    `begin;set local statement_timeout='10s';${auth(uid(7))}select public.assign_account_role('${uid(6)}','manager',1);commit;`,
  );
  await waitingOnAdvisory("approved-role-change-after-staff-setup");
  await finish(setupBeforeRole);
  await roleChange.done;
  await assert.rejects(
    sql(`begin;${auth(uid(6))}${staffSetup(uid(6))}commit;`),
    /staff access changed/,
  );
  assert.equal(
    (
      await sql(
        `select role||':'||version from public.account_roles where user_id='${uid(6)}';`,
      )
    ).trim(),
    "manager:2",
  );
  console.log(
    "PASS staff setup/role administration: role change serializes after acceptance; stale setup retry is rejected",
  );
} finally {
  if (started) await command(["rm", "-f", container]);
}
