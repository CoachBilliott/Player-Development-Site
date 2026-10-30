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
    "015-staff-client-service-dashboard.sql",
    "023-staff-roster-pages.sql",
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
type Row = {
  client_id: string;
  client_label: string;
  athlete_id: string | null;
  athlete_name: string | null;
  resources: Record<string, unknown>[];
  eligible_access: boolean;
  media_ready: boolean;
  next_action: string;
  last_opened_at: string | null;
  last_completion_at: string | null;
  first_available_at: string | null;
  pending_reviews: number;
  overdue_reviews: number;
  review_tasks: unknown[];
};
async function roster(actor = owner) {
  await as(actor);
  return (
    await db.query<{
      result: { rows: Row[]; scope: string; coaches: unknown[] };
    }>("select public.staff_client_service_roster() result")
  ).rows[0].result;
}
async function detail(p = profile) {
  return (
    await db.query<{ result: Row }>(
      "select public.staff_athlete_service($1) result",
      [p],
    )
  ).rows[0].result;
}
async function assign(p = profile, c: string | null = coach, v = 0) {
  await as(owner);
  return (
    await db.query<{ version: number }>(
      "select * from public.assign_athlete_service_coach($1,$2,$3)",
      [p, c, v],
    )
  ).rows[0];
}
async function deny(sql: string, args: unknown[], pattern: RegExp) {
  await db.exec("savepoint denied");
  await expect(db.query(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint denied");
}
async function training() {
  await as(coach);
  await db.query(
    "select public.save_training_workout($1,'Fictional ready-position session','Illustrative adult draft',$2,0)",
    [id(20), [first]],
  );
  await as(owner);
  await db.query("select public.assign_profile_workout($1,$2,$3,1,0)", [
    parent,
    profile,
    id(20),
  ]);
}
it("Owners and Managers see all current Repformed clients/athletes; Coaches see only explicit athlete assignments", async () => {
  for (const actor of [owner, manager]) {
    const data = await roster(actor);
    expect(data.rows).toHaveLength(3);
    expect(new Set(data.rows.map((r) => r.client_id)).size).toBe(2);
    expect(data.scope).toBe("all_repformed_clients");
  }
  expect((await roster(coach)).rows).toEqual([]);
  await assign();
  await assign(sibling, id(4));
  const data = await roster(coach);
  expect(data.rows.map((r) => r.athlete_id)).toEqual([profile]);
  expect(data.rows[0].client_label).toMatch(/^Client /);
  expect(data.coaches).toEqual([]);
  await deny(
    "select public.staff_athlete_service($1)",
    [sibling],
    /outside your service roster/,
  );
  expect(
    (await db.query("select profile_id from public.athlete_service_coaches"))
      .rows,
  ).toEqual([{ profile_id: profile }]);
});
it("denies customers/anonymous direct APIs and prevents Coaches changing assignments and Managers/Coaches changing account roles", async () => {
  for (const actor of [parent, otherParent]) {
    await as(actor);
    await deny(
      "select public.staff_client_service_roster()",
      [],
      /Staff access/,
    );
    await deny(
      "select public.staff_athlete_service($1)",
      [profile],
      /outside your service roster/,
    );
  }
  for (const actor of [manager, coach]) {
    await as(actor);
    if (actor === coach)
      await deny(
        "select public.assign_athlete_service_coach($1,$2,0)",
        [profile, coach],
        /Owner or Manager access/,
      );
    await deny(
      "select public.assign_account_role($1,'owner',1)",
      [actor],
      /owners|Owner/,
    );
    await deny(
      "insert into public.athlete_service_coaches(profile_id,coach_id) values($1,$2)",
      [profile, coach],
      /permission denied/,
    );
  }
  await as("", "anon");
  await deny(
    "select public.staff_client_service_roster()",
    [],
    /permission denied/,
  );
});
it("reassignment and revocation remove old Coach scope; repeated writes are idempotent and stale writes fail", async () => {
  expect((await assign()).version).toBe(1);
  expect((await assign()).version).toBe(1);
  await deny(
    "select public.assign_athlete_service_coach($1,$2,0)",
    [profile, id(4)],
    /assignment changed/,
  );
  await assign(profile, id(4), 1);
  expect((await roster(coach)).rows).toEqual([]);
  await deny(
    "select public.staff_athlete_service($1)",
    [profile],
    /outside your service roster/,
  );
  expect((await roster(id(4))).rows.map((r) => r.athlete_id)).toEqual([
    profile,
  ]);
  await assign(profile, null, 2);
  expect((await roster(id(4))).rows).toEqual([]);
});
it("Managers can assign, change and revoke service coaches with the same version and staff validation guards", async () => {
  expect(
    (await roster(manager)).coaches.some(
      (c: unknown) => (c as { id: string }).id === coach,
    ),
  ).toBe(true);
  await as(manager);
  await db.query("select public.assign_athlete_service_coach($1,$2,0)", [
    profile,
    coach,
  ]);
  expect((await roster(coach)).rows.map((r) => r.athlete_id)).toEqual([
    profile,
  ]);
  await as(manager);
  await db.query("select public.assign_athlete_service_coach($1,$2,1)", [
    profile,
    id(4),
  ]);
  expect((await roster(coach)).rows).toEqual([]);
  await as(manager);
  await deny(
    "select public.assign_athlete_service_coach($1,$2,0)",
    [profile, null],
    /changed/,
  );
  await deny(
    "select public.assign_athlete_service_coach($1,$2,2)",
    [profile, parent],
    /verified active coaching staff/,
  );
  await db.query("select public.assign_athlete_service_coach($1,null,2)", [
    profile,
  ]);
  expect((await roster(id(4))).rows).toEqual([]);
});
it("basic roster visibility never grants unrelated private videos, feedback, family controls or sensitive raw profile APIs", async () => {
  await assign(profile, id(4));
  await as("", "postgres");
  const video = id(70),
    path = `${parent}/${profile}/${video}.mp4`;
  await db.query(
    "insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds,status,feedback) values($1,$2,$3,$3,$4,'Fictional drill',$5,'video/mp4',1000,30,'queued','PRIVATE FEEDBACK')",
    [video, profile, parent, first, path],
  );
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'athlete-review-videos\',$1,\'{"size":1000,"mimetype":"video/mp4"}\')',
    [path],
  );
  for (const actor of [owner, manager, id(4)]) {
    await as(actor);
    const d = await detail();
    expect(JSON.stringify(d)).not.toContain("PRIVATE FEEDBACK");
    expect(JSON.stringify(d)).not.toContain(path);
    expect(
      (await db.query("select id from public.athlete_video_reviews")).rows,
    ).toEqual([]);
    expect(
      (await db.query("select public.can_view_athlete($1) allowed", [profile]))
        .rows,
    ).toEqual([{ allowed: false }]);
    await deny(
      "select public.family_profile_state($1)",
      [profile],
      /not available/,
    );
  }
});
it("reports unassigned, overdue and blocked states without inventing opened, available, payment or notification telemetry", async () => {
  await assign();
  await training();
  await as(owner);
  let d = await detail();
  expect(d.eligible_access).toBe(true);
  expect(d.media_ready).toBe(false);
  expect(d.next_action).toBe("Complete training upload");
  expect(d.last_opened_at).toBeNull();
  expect(d.first_available_at).toBeNull();
  await as("", "postgres");
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'training-media\',$1,\'{"size":1000,"mimetype":"text/plain"}\')',
    [`${coach}/${first}/${first}.txt`],
  );
  await db.query(
    "insert into public.review_services(id,account_id,profile_id,assigned_to,drill_title,state,ready_at,due_at) values($1,$2,$3,$4,'Fictional overdue review','queued',now()-interval '49 hours',now()-interval '1 hour')",
    [id(75), parent, profile, coach],
  );
  await as(owner);
  d = await detail();
  expect(d.media_ready).toBe(true);
  expect(d.overdue_reviews).toBe(1);
  expect(d.next_action).toBe("Follow up overdue review");
  await as(parent);
  await db.query("select public.report_saved_workout($1,$2,$3,$4,1)", [
    id(76),
    profile,
    [first],
    id(20),
  ]);
  await as(manager);
  d = await detail();
  expect(d.last_completion_at).not.toBeNull();
  expect(d.last_opened_at).toBeNull();
  await as("", "postgres");
  await db.query(
    "update public.training_resources set review_stage='changes_requested',status='draft' where id=$1",
    [first],
  );
  await as(owner);
  expect((await detail()).eligible_access).toBe(false);
});
it("shows client setup without fabricating athletes and hides records frozen for erasure", async () => {
  await as("", "postgres");
  const fresh = id(8);
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-empty-client@example.test',now())",
    [fresh],
  );
  await db.query(
    "insert into public.account_roles(user_id,role) values($1,'parent')",
    [fresh],
  );
  await db.query(
    "insert into public.member_accounts(user_id,account_type) values($1,'parent')",
    [fresh],
  );
  expect(
    (await roster(manager)).rows.find((r) => r.client_id === fresh),
  ).toMatchObject({
    athlete_id: null,
    next_action: "Complete private athlete setup",
  });
  await assign();
  await as("", "postgres");
  await db.query(
    "insert into public.account_closures(id,user_id,state) values($1,$2,'cleaning')",
    [id(90), parent],
  );
  expect((await roster(owner)).rows.some((r) => r.client_id === parent)).toBe(
    false,
  );
  expect((await roster(coach)).rows).toEqual([]);
});

type PageResult = {
  rows: Row[];
  scope: string;
  coaches: { id: string; label: string }[];
  page: {
    number: number;
    size: number;
    pages: number;
    total: number;
    matched: number;
    athletes: number;
    clients: number;
    counts: { overdue: number; attention: number; ready: number };
    ages: string[];
    positions: string[];
    coaches: { id: string; label: string }[];
  };
};
async function pageRoster(
  actor = owner,
  query = "",
  filter = "all",
  age = "",
  position = "",
  coachFilter = "",
  page = 1,
  size = 25,
) {
  await as(actor);
  return (
    await db.query<{ result: PageResult }>(
      "select public.staff_client_service_roster_page($1,$2,$3,$4,$5,$6,$7) result",
      [query, filter, age, position, coachFilter, page, size],
    )
  ).rows[0].result;
}
it("paged roster retains Owner/Manager all-client scope and exact assigned-Coach scope", async () => {
  await assign(profile, coach);
  await assign(sibling, id(4));
  await assign(otherProfile, id(4));
  for (const actor of [owner, manager]) {
    const r = await pageRoster(actor);
    expect(r.page.total).toBe(3);
    expect(r.page.clients).toBe(2);
    expect(r.page.athletes).toBe(3);
    expect(r.rows).toHaveLength(3);
  }
  const c = await pageRoster(coach);
  expect(c.scope).toBe("assigned_athletes");
  expect(c.rows.map((r) => r.athlete_id)).toEqual([profile]);
  expect(c.page.total).toBe(1);
  expect(c.coaches).toEqual([]);
  expect(c.page.coaches.map((r) => r.id)).toEqual([coach]);
  expect(c.rows[0].client_label).toBe(`Client ${parent.slice(0, 8)}`);
  await deny(
    "select public.staff_athlete_service($1)",
    [sibling],
    /outside your service roster/,
  );
});
it("paged search cannot infer hidden client email through Coach match counts", async () => {
  await assign();
  const email = "fictional-workout-5@example.test";
  expect((await pageRoster(owner, email)).page.matched).toBe(2);
  const c = await pageRoster(coach, email);
  expect(c.page.matched).toBe(0);
  expect(c.rows).toEqual([]);
  expect(c.page.total).toBe(1);
  expect(
    (await pageRoster(coach, `Client ${parent.slice(0, 8)}`)).page.matched,
  ).toBe(1);
});
it("paged search normalizes accents, quoted words and whitespace without wildcard or SQL interpretation", async () => {
  await db.query("update public.player_profiles set nickname=$1 where id=$2", [
    "Ávery O'Neil",
    sibling,
  ]);
  const r = await pageRoster(owner, "  AVERY  o'neil  ");
  expect(r.page.matched).toBe(1);
  expect(r.rows[0].athlete_id).toBe(sibling);
  expect((await pageRoster(owner, "%")).rows).toEqual([]);
  expect((await pageRoster(owner, "x' OR true --")).rows).toEqual([]);
});
it("server status counts require accessible uploaded training, not only a saved assignment", async () => {
  await assign();
  await training();
  let r = await pageRoster(owner, "", "ready");
  expect(r.page.matched).toBe(0);
  expect(r.page.counts.ready).toBe(0);
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('training-media',$1,$2)",
    [`${coach}/${first}/${first}.txt`, { size: 12, mimetype: "text/plain" }],
  );
  r = await pageRoster(owner, "", "ready");
  expect(r.page.matched).toBe(1);
  expect(r.rows[0].athlete_id).toBe(profile);
  expect(r.page.total).toBe(3);
  expect(r.page.counts.ready).toBe(1);
  await db.exec("reset role");
  await db.exec(
    'update storage.objects set metadata=\'{"size":0,"mimetype":"text/plain"}\'',
  );
  expect((await pageRoster(owner, "", "ready")).page.matched).toBe(0);
});
it("paged filters combine on the server and facets/counts remain within the full authorized scope", async () => {
  await assign(profile, coach);
  await assign(sibling, id(4));
  const r = await pageRoster(owner, "", "all", "18+", "Defensive back", id(4));
  expect(r.rows.map((r) => r.athlete_id)).toEqual([sibling]);
  expect(r.page.matched).toBe(1);
  expect(r.page.total).toBe(3);
  expect(r.page.positions).toEqual(["Defensive back", "Quarterback"]);
  expect(
    (await pageRoster(owner, "", "unassigned")).rows.map((r) => r.athlete_id),
  ).toEqual([otherProfile]);
  expect((await pageRoster(coach, "", "all", "", "", id(4))).page.matched).toBe(
    0,
  );
});
it("review scope and overdue priority do not reveal another review coach's tasks", async () => {
  await assign();
  await training();
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('training-media',$1,$2)",
    [`${coach}/${first}/${first}.txt`, { size: 12, mimetype: "text/plain" }],
  );
  await db.query(
    "insert into public.review_services(id,account_id,profile_id,assigned_to,state,due_at) values($1,$2,$3,$4,'queued',now()-interval '1 hour')",
    [id(700), parent, profile, id(4)],
  );
  const o = await pageRoster(owner, "", "overdue");
  expect(o.rows[0].athlete_id).toBe(profile);
  expect(o.page.counts.overdue).toBe(1);
  const c = await pageRoster(coach, "", "overdue");
  expect(c.rows).toEqual([]);
  expect(c.page.counts.overdue).toBe(0);
  expect(c.page.counts.ready).toBe(1);
});
it("reassignment, unassignment and role changes revoke new page/detail reads immediately", async () => {
  await assign();
  expect((await pageRoster(coach)).rows).toHaveLength(1);
  await assign(profile, id(4), 1);
  expect((await pageRoster(coach)).rows).toEqual([]);
  expect((await pageRoster(id(4))).rows).toHaveLength(1);
  await assign(profile, null, 2);
  expect((await pageRoster(id(4))).rows).toEqual([]);
  await db.exec("reset role");
  await db.query(
    "update public.account_roles set role='parent' where user_id=$1",
    [coach],
  );
  await as(coach);
  await deny(
    "select public.staff_client_service_roster_page()",
    [],
    /Staff access/,
  );
});
it("anonymous, parents and other nonstaff cannot call the page RPC or its internal helper", async () => {
  for (const actor of [parent, otherParent]) {
    await as(actor);
    await deny(
      "select public.staff_client_service_roster_page()",
      [],
      /Staff access/,
    );
  }
  await as(owner);
  await deny(
    "select public.staff_service_search('private')",
    [],
    /permission denied/,
  );
  await as("", "anon");
  await deny(
    "select public.staff_client_service_roster_page()",
    [],
    /permission denied/,
  );
});
it("invalid page/filter requests fail before returning partial results", async () => {
  await as(owner);
  for (const args of [
    ["", "all", "", "", "", 0, 25],
    ["", "all", "", "", "", 1, 101],
    ["x".repeat(161), "all", "", "", "", 1, 25],
    ["", "all", "", "", "not-a-coach", 1, 25],
    ["", "other", "", "", "", 1, 25],
  ])
    await deny(
      "select public.staff_client_service_roster_page($1,$2,$3,$4,$5,$6,$7)",
      args,
      /valid roster filters/,
    );
});
it("customers without profiles remain visible only to Owner/Manager with accurate household counts", async () => {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-no-athlete@example.test',now())",
    [id(99)],
  );
  await db.query(
    "insert into public.account_roles(user_id,role) values($1,'parent')",
    [id(99)],
  );
  await db.query(
    "insert into public.member_accounts(user_id,account_type) values($1,'parent')",
    [id(99)],
  );
  const o = await pageRoster(owner);
  expect(o.page.total).toBe(4);
  expect(o.page.athletes).toBe(3);
  expect(o.page.clients).toBe(3);
  expect(o.rows.some((r) => r.athlete_id === null)).toBe(true);
  expect((await pageRoster(coach)).rows).toEqual([]);
});
it("1000 extra athletes page without duplicate IDs, clamp stale pages, and expand rich details only for displayed rows", async () => {
  await db.exec(`insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal)
 select ('90000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,'${parent}','Scale fictional '||lpad(n::text,4,'0'),'18+','Quarterback','New to the game','Footwork' from generate_series(0,999) n;`);
  const a = await pageRoster(owner),
    b = await pageRoster(owner, "", "all", "", "", "", 2);
  expect(a.page.total).toBe(1003);
  expect(a.page.matched).toBe(1003);
  expect(a.page.pages).toBe(41);
  expect(a.rows).toHaveLength(25);
  expect(b.rows).toHaveLength(25);
  expect(new Set([...a.rows, ...b.rows].map((r) => r.athlete_id)).size).toBe(
    50,
  );
  const last = await pageRoster(owner, "", "all", "", "", "", 999999);
  expect(last.page.number).toBe(41);
  expect(last.rows).toHaveLength(3);
  const match = await pageRoster(
    owner,
    "Scale fictional 0999",
    "all",
    "",
    "",
    "",
    40,
  );
  expect(match.page.number).toBe(1);
  expect(match.page.matched).toBe(1);
  expect(match.rows).toHaveLength(1);
  await db.exec("reset role");
  const definition = (
    await db.query<{ definition: string }>(
      "select pg_get_functiondef('public.staff_athlete_service(uuid)'::regprocedure) definition",
    )
  ).rows[0].definition;
  await db.exec(
    definition.replace(
      /\bbegin\b/i,
      "begin perform set_config('test.roster_expansions',(coalesce(nullif(current_setting('test.roster_expansions',true),''),'0')::integer+1)::text,true);",
    ),
  );
  await db.query("select set_config('test.roster_expansions','0',true)");
  await pageRoster(owner);
  expect(
    (
      await db.query<{ calls: string }>(
        "select current_setting('test.roster_expansions') calls",
      )
    ).rows[0].calls,
  ).toBe("25");
});
it("the reviewed rollback removes only the new read capability and preserves legacy service/data", async () => {
  const countBefore = (
    await db.query<{ n: number }>(
      "select count(*)::integer n from public.player_profiles",
    )
  ).rows[0].n;
  const sql = readFileSync(
    new URL("../backend/rollback/023-staff-roster-pages.sql", import.meta.url),
    "utf8",
  )
    .replace(/^begin;$/m, "")
    .replace(/^commit;$/m, "");
  await db.exec(sql);
  expect(
    (
      await db.query<{ missing: boolean }>(
        "select to_regprocedure('public.staff_client_service_roster_page(text,text,text,text,text,integer,integer)') is null missing",
      )
    ).rows[0].missing,
  ).toBe(true);
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::integer n from public.player_profiles",
      )
    ).rows[0].n,
  ).toBe(countBefore);
  expect((await roster(owner)).rows).toHaveLength(3);
  await as(parent);
  await deny("select public.staff_client_service_roster()", [], /Staff access/);
});
