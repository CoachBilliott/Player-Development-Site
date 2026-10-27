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
    "013-preview-review-groups.sql",
    "014-grouped-review-fulfillment.sql",
    "015-staff-client-service-dashboard.sql",
    "016-delivery-monitoring-and-inbox.sql",
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

const rule = {
  weekday: 0,
  time: "00:00",
  timezone: "UTC",
  grace_minutes: 60,
  escalation_minutes: 120,
  routing: "assigned_coach",
  notify_training: true,
  notify_reviews: true,
  email_requested: false,
  submission_reminders: false,
};
async function result<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  return (await db.query<{ r: T }>(sql, args)).rows[0]?.r;
}
async function blocked(
  sql: string,
  args: unknown[] = [],
  pattern = /permission|access|scope/i,
) {
  await db.exec("savepoint blocked");
  await expect(db.query(sql, args)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint blocked");
}
async function configure() {
  await as("", "postgres");
  await db.exec("update public.delivery_monitor_settings set enabled=true");
  await as(owner);
  await db.query(
    "select public.save_delivery_package($1,'Fictional package',$2,0)",
    [id(80), rule],
  );
  await db.query(
    "select public.save_delivery_override($1,'client',$2,'{}','active',0)",
    [profile, id(80)],
  );
  await db.query("select public.assign_athlete_service_coach($1,$2,0)", [
    profile,
    coach,
  ]);
}
async function workout() {
  await as(coach);
  await db.query(
    "select public.save_training_workout($1,'Fictional session','Illustrative',$2,0)",
    [id(20), [first]],
  );
}
async function assignWorkout() {
  await as(owner);
  await db.query("select public.assign_profile_workout($1,$2,$3,1,0)", [
    parent,
    profile,
    id(20),
  ]);
}
async function plan() {
  await as(owner);
  await db.query(
    "select public.plan_delivery_check($1,$2,'test-week',$3,1,current_date-extract(dow from current_date)::integer-7,((current_date-extract(dow from current_date)::integer-7)::timestamp at time zone 'UTC'))",
    [id(81), profile, id(20)],
  );
}
async function media() {
  await as("", "postgres");
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'training-media\',$1,\'{"size":1000,"mimetype":"text/plain"}\')',
    [`${coach}/${first}/${first}.txt`],
  );
}
async function evaluate(actor = owner, p = profile) {
  await as(actor);
  await db.query("select public.evaluate_delivery_checks($1)", [p]);
}
async function notices(actor = parent) {
  await as(actor);
  return await result<
    {
      id: string;
      kind: string;
      read_at: string | null;
      available_now: boolean;
      email_status: string;
    }[]
  >("select public.my_content_notices() r");
}
async function workspace(actor = owner, p = profile) {
  await as(actor);
  return await result<{
    effective_rule: typeof rule;
    checks: {
      id: string;
      first_observed_available_at: string | null;
      available_now: boolean;
      alert: {
        state: string;
        escalated_at: string | null;
        episode: number;
      } | null;
    }[];
    enabled: boolean;
  }>("select public.delivery_profile_workspace($1) r", [p]);
}

it("keeps monitoring default-off, limits configuration to Owner and scopes direct RPC/table access", async () => {
  await as(owner);
  expect((await workspace()).enabled).toBe(false);
  await blocked(
    "select public.evaluate_delivery_checks($1)",
    [profile],
    /not been activated/,
  );
  for (const actor of [manager, coach, parent]) {
    await as(actor);
    await blocked(
      "select public.save_delivery_package($1,'No',$2,0)",
      [id(80), rule],
      /Owner access/,
    );
  }
  await configure();
  expect((await workspace(coach)).effective_rule.time).toBe("00:00");
  await as(coach);
  await blocked(
    "select public.delivery_profile_workspace($1)",
    [sibling],
    /outside/,
  );
  await as(parent);
  await blocked(
    "select public.delivery_profile_workspace($1)",
    [profile],
    /outside/,
  );
  await blocked(
    "select * from public.content_notices",
    [],
    /permission denied/,
  );
  await blocked(
    "update public.delivery_monitor_settings set enabled=true",
    [],
    /permission denied/,
  );
  await as("", "anon");
  await blocked("select public.my_content_notices()", [], /permission denied/);
});
it("applies package/client/athlete precedence with idempotence and rejects stale sibling edits", async () => {
  await configure();
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'client',$2,$3,'active',1)",
    [profile, id(80), { time: "09:00", grace_minutes: 30 }],
  );
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,$2,'active',0)",
    [profile, { grace_minutes: 15 }],
  );
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,$2,'active',0)",
    [profile, { grace_minutes: 15 }],
  );
  expect((await workspace()).effective_rule).toMatchObject({
    time: "09:00",
    grace_minutes: 15,
  });
  expect((await workspace(owner, sibling)).effective_rule).toMatchObject({
    time: "09:00",
    grace_minutes: 30,
  });
  await blocked(
    "select public.save_delivery_override($1,'client',$2,$3,'active',1)",
    [sibling, id(80), { time: "10:00" }],
    /changed/,
  );
  await blocked(
    "select public.save_delivery_package($1,'Bad',$2,0)",
    [id(82), { ...rule, routing: "parent" }],
    /staff-only/,
  );
  await blocked(
    "select public.save_delivery_override($1,'athlete',null,$2,'active',1)",
    [profile, { submission_reminders: true }],
    /keep disabled/,
  );
});
it("validates time zones and DST at the server, rejecting skipped/repeated local time", async () => {
  await as("", "postgres");
  expect(
    await result<string>(
      "select public.delivery_wall_instant('2026-11-01','08:00','America/Chicago')::text r",
    ),
  ).toContain("14:00:00");
  expect(
    await result<string>(
      "select public.delivery_wall_instant('2026-10-25','08:00','America/Chicago')::text r",
    ),
  ).toContain("13:00:00");
  for (const [d, t, z] of [
    ["2026-11-01", "01:30", "America/Chicago"],
    ["2026-03-08", "02:30", "America/Chicago"],
    ["2026-11-01", "08:00", "Not/AZone"],
  ])
    await blocked(
      "select public.delivery_wall_instant($1,$2,$3)",
      [d, t, z],
      /clock change|time zone/,
    );
});
it("requires exact assignment/version, approved content and full media, then deduplicates content notices", async () => {
  await configure();
  await workout();
  await plan();
  await evaluate();
  expect(await notices()).toEqual([]);
  await media();
  await evaluate();
  expect(await notices()).toEqual([]); // received is not assigned
  await assignWorkout();
  await evaluate();
  await evaluate();
  const inbox = await notices();
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({
    kind: "training_ready",
    available_now: true,
    email_status: "disabled",
  });
  expect(
    (await workspace()).checks[0].first_observed_available_at,
  ).not.toBeNull();
  await as("", "postgres");
  await db.query(
    "update public.training_resources set status='draft',review_stage='changes_requested' where id=$1",
    [first],
  );
  await evaluate();
  expect((await notices())[0].available_now).toBe(false);
  expect((await workspace()).checks[0].alert?.state).toBe("open");
});
it("does not notify future checks, respects exact grace boundary, resolves paused alerts and deduplicates escalation", async () => {
  await configure();
  await workout();
  await plan();
  await as("", "postgres");
  await db.query(
    "update public.delivery_expectations set due_at=now()+interval '2 hours',notice_not_before=now()+interval '1 hour' where id=$1",
    [id(81)],
  );
  await assignWorkout();
  await media();
  await evaluate();
  expect(await notices()).toEqual([]);
  expect((await workspace()).checks[0].alert).toBeNull();
  await as("", "postgres");
  await db.exec("delete from storage.objects where bucket_id='training-media'");
  await db.query(
    "update public.delivery_expectations set due_at=now()-interval '59 minutes',notice_not_before=now()-interval '2 hours' where id=$1",
    [id(81)],
  );
  await evaluate();
  expect((await workspace()).checks[0].alert).toBeNull();
  await as("", "postgres");
  await db.query(
    "update public.delivery_expectations set due_at=now()-interval '60 minutes' where id=$1",
    [id(81)],
  );
  await evaluate();
  expect((await workspace()).checks[0].alert?.state).toBe("open");
  await as(coach);
  await db.query("select public.acknowledge_delivery_alert($1)", [id(81)]);
  await db.query("select public.acknowledge_delivery_alert($1)", [id(81)]);
  await evaluate();
  expect((await workspace()).checks[0].alert?.state).toBe("acknowledged");
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{}','paused',0)",
    [profile],
  );
  await evaluate();
  expect((await workspace()).checks[0].alert?.state).toBe("resolved");
  expect(await notices()).toEqual([]);
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,'{}','active',1)",
    [profile],
  );
  await as("", "postgres");
  await db.query(
    "update public.delivery_expectations set due_at=now()-interval '4 hours',notice_not_before=now()-interval '5 hours' where id=$1",
    [id(81)],
  );
  await evaluate();
  await evaluate();
  const alert = (await workspace()).checks[0].alert;
  expect(alert).toMatchObject({ state: "open", episode: 2 });
  expect(alert?.escalated_at).not.toBeNull();
});
it("keeps overdue alerts staff-only and preserves snapshot deadlines through package changes", async () => {
  await configure();
  await workout();
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'athlete',null,$2,'active',0)",
    [profile, { routing: "owners_managers" }],
  );
  await plan();
  await evaluate();
  expect((await workspace(coach)).checks[0].alert).toBeNull();
  await as(coach);
  await blocked(
    "select public.acknowledge_delivery_alert($1)",
    [id(81)],
    /outside your scope/,
  );
  await as(owner);
  await db.query(
    "select public.save_delivery_package($1,'Updated package',$2,1)",
    [id(80), { ...rule, time: "10:00" }],
  );
  await as("", "postgres");
  expect(
    await result<string>(
      "select rule_snapshot->>'time' r from public.delivery_expectations where id=$1",
      [id(81)],
    ),
  ).toBe("00:00");
  expect(await notices()).toEqual([]);
});
it("sends only to verified authorized adult guardians, never the linked child or another household", async () => {
  await configure();
  await workout();
  await assignWorkout();
  await media();
  await plan();
  await as("", "postgres");
  await db.exec("update public.profile_settings set under18_enabled=true");
  await db.query(
    "update public.player_profiles set age_group='8–12',guardian_confirmed=true where id=$1",
    [profile],
  );
  await db.query(
    "insert into public.family_athlete_links(profile_id,athlete_user_id) values($1,$2)",
    [profile, id(4)],
  );
  await evaluate();
  expect(await notices()).toEqual([]);
  await as("", "postgres");
  await db.query(
    "insert into public.guardian_access_reviews values($1,now(),'synthetic local review only')",
    [profile],
  );
  // The unit checks recipient authorization independently of age-incompatible
  // training. Nothing opens real minor enrollment or invents coaching approval.
  expect(
    await result<string>("select public.delivery_recipient($1) r", [profile]),
  ).toBe(parent);
  expect(await notices(id(4))).toEqual([]);
  expect(await notices(otherParent)).toEqual([]);
  await as("", "postgres");
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    parent,
  ]);
  expect(
    await result<string | null>("select public.delivery_recipient($1) r", [
      profile,
    ]),
  ).toBeNull();
});
it("supports private read/unread state, duplicate reads and access withdrawal without exposing media or email", async () => {
  await configure();
  await workout();
  await assignWorkout();
  await media();
  await plan();
  await evaluate();
  const n = (await notices())[0];
  expect(n.read_at).toBeNull();
  expect(JSON.stringify(n)).not.toMatch(
    /example.test|asset_path|feedback|signed/,
  );
  await as(otherParent);
  await blocked("select public.read_content_notice($1)", [n.id], /unavailable/);
  await as(parent);
  await db.query("select public.read_content_notice($1)", [n.id]);
  await db.query("select public.read_content_notice($1)", [n.id]);
  expect((await notices())[0].read_at).not.toBeNull();
  await as("", "postgres");
  await db.query(
    "update public.delivery_expectations set state='cancelled' where id=$1",
    [id(81)],
  );
  await evaluate();
  expect((await notices())[0].available_now).toBe(true); // Monitoring cancellation does not revoke access.
  await as("", "postgres");
  await db.exec("delete from storage.objects where bucket_id='training-media'");
  expect((await notices())[0].available_now).toBe(false);
  expect((await workspace()).checks[0].alert?.state).not.toBe("open");
});
it("creates a review-ready event only after feedback delivery, and prevents cross-coach evaluation", async () => {
  await configure();
  await as("", "postgres");
  await db.query(
    "insert into public.review_services(id,account_id,profile_id,assigned_to,drill_title,state,is_grouped,group_feedback,delivered_at) values($1,$2,$3,$4,'Synthetic review','in_review',true,'',null)",
    [id(85), parent, profile, coach],
  );
  await evaluate();
  expect(await notices()).toEqual([]);
  await as("", "postgres");
  await db.query(
    "update public.review_services set state='delivered',group_feedback='Synthetic private feedback',delivered_at=now(),group_submitted_at=now(),group_reviewed_by='90000000-0000-4000-8000-000000000003' where id=$1",
    [id(85)],
  );
  await evaluate(coach);
  await evaluate(coach);
  expect((await notices()).map((n) => n.kind)).toEqual(["review_ready"]);
  await as(owner);
  await db.query("select public.assign_athlete_service_coach($1,$2,1)", [
    profile,
    id(4),
  ]);
  await as(coach);
  await blocked(
    "select public.evaluate_delivery_checks($1)",
    [profile],
    /outside/,
  );
  await as("", "postgres");
  await db.query(
    "update public.review_services set group_erased=true,group_feedback='' where id=$1",
    [id(85)],
  );
  expect((await notices())[0].available_now).toBe(false);
});

it("rejects partial delivery and wrong-sibling assignments before creating one full-session notice", async () => {
  await configure();
  await as("", "postgres");
  await db.query(
    "update public.player_profiles set experience='New to the game' where id=$1",
    [sibling],
  );
  await as(coach);
  await db.query(
    "select public.save_training_workout($1,'Two fictional drills','Illustrative',$2,0)",
    [id(20), [first, third]],
  );
  await plan();
  await as(owner);
  await db.query("select public.assign_profile_workout($1,$2,$3,1,0)", [
    parent,
    sibling,
    id(20),
  ]);
  await media();
  await evaluate();
  expect(await notices()).toEqual([]);
  await assignWorkout();
  await evaluate();
  expect(await notices()).toEqual([]);
  await as("", "postgres");
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'training-media\',$1,\'{"size":1000,"mimetype":"text/plain"}\')',
    [`${coach}/${third}/${third}.txt`],
  );
  await evaluate();
  expect(await notices()).toHaveLength(1);
  await as(manager);
  expect(
    await result<unknown[]>("select public.delivery_staff_queue() r"),
  ).toEqual([]);
});
it("applies client-wide pause/cancel and exact expectation cancellation without altering billing or emailing", async () => {
  await configure();
  await workout();
  await assignWorkout();
  await media();
  await plan();
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'client',$2,$3,'paused',1)",
    [profile, id(80), { email_requested: true }],
  );
  await evaluate();
  expect(await notices()).toEqual([]);
  await as(owner);
  await db.query(
    "select public.save_delivery_override($1,'client',$2,$3,'active',2)",
    [profile, id(80), { email_requested: true }],
  );
  await evaluate();
  expect((await notices())[0].email_status).toBe("disabled");
  await as(manager);
  await blocked(
    "select public.set_delivery_check_state($1,'cancelled','active')",
    [id(81)],
    /Owner access/,
  );
  await as(owner);
  await db.query(
    "select public.set_delivery_check_state($1,'cancelled','active')",
    [id(81)],
  );
  await db.query(
    "select public.set_delivery_check_state($1,'cancelled','active')",
    [id(81)],
  );
  expect((await notices())[0].available_now).toBe(true); // Content remains entitled; only monitoring was cancelled.
  await as(parent);
  await blocked("select public.delivery_staff_queue()", [], /Staff access/);
});
