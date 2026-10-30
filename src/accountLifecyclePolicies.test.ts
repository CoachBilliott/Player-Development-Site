import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
let db: PGlite;
const id = (n: number) =>
  `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, manager, coach, parent, other, recipient] = [
  1, 2, 3, 4, 5, 6,
].map(id);
const profile = id(10),
  otherProfile = id(11),
  invite = id(20),
  request = id(30);
const path = (account: string, p: string, video: number) =>
  `${account}/${p}/${id(video)}.mp4`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,role text default 'authenticated',created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
  create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
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
  ])
    await db.exec(
      readFileSync(new URL("../backend/" + file, import.meta.url), "utf8"),
    );
  for (const [user, role] of [
    [owner, "owner"],
    [manager, "manager"],
    [coach, "coach"],
    [parent, "parent"],
    [other, "parent"],
  ]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [user, `fictional-${user}@example.test`],
    );
    await db.query(
      "insert into public.account_roles(user_id,role) values($1,$2)",
      [user, role],
    );
  }
  await db.exec(`insert into public.member_accounts(user_id,account_type) values('${parent}','parent'),('${other}','parent');
  insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal) values
  ('${profile}','${parent}','Fictional adult','18+','Quarterback','New to the game','Footwork'),
  ('${otherProfile}','${other}','Other fictional adult','18+','Quarterback','New to the game','Footwork');`);
  await db.exec(
    readFileSync(
      new URL(
        "../backend/010-account-invitations-and-closure.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../backend/025-account-names.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as(user = "", role = "authenticated") {
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function value<T>(query: string, args: unknown[] = []) {
  return (await db.query<{ value: T }>(`select ${query} as value`, args))
    .rows[0].value;
}
async function newRecipient(confirmed = true) {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,created_at) values($1,'invited@example.test',case when $2 then now() else null end,now()+interval '1 second')",
    [recipient, confirmed],
  );
}
async function reserve(role = "coach", actor = owner) {
  await as("", "service_role");
  return value<{ deliver: boolean; invitation: { version: number } }>(
    "public.begin_account_invitation($1,$2,'Invited@EXAMPLE.test',$3)",
    [actor, invite, role],
  );
}
async function sent() {
  await reserve();
  await as("", "postgres");
  await newRecipient();
  await as("", "service_role");
  await value("public.finish_account_invitation($1,$2,'sent')", [
    invite,
    recipient,
  ]);
}
async function start() {
  await as("", "service_role");
  return value("public.begin_account_closure($1,$2)", [parent, request]);
}
async function videos() {
  for (const [a, p, by, key] of [
    [parent, profile, parent, 40],
    [other, otherProfile, parent, 41],
    [other, otherProfile, other, 42],
  ] as const)
    await db.query(
      `insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,drill_title,asset_path,media_type,byte_size,duration_seconds)
    values($1,$2,$3,$4,'Fictional reference',$5,'video/mp4',100,1)`,
      [id(key), p, a, by, path(a, p, key)],
    );
  for (const [a, p, key] of [
    [parent, profile, 40],
    [other, otherProfile, 41],
    [other, otherProfile, 42],
    [parent, profile, 43],
  ] as const)
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('athlete-review-videos',$1,'{}')",
      [path(a, p, key)],
    );
}

it("keeps invite/closure tables and service RPCs private even from an authenticated Owner", async () => {
  await as(owner);
  await expect(
    db.query("select * from public.account_invitations"),
  ).rejects.toThrow(/permission denied/);
});
it("denies privileged deletion RPC calls from the browser", async () => {
  await as(owner);
  await expect(startFromBrowser()).rejects.toThrow(/permission denied/);
});
async function startFromBrowser() {
  return value("public.begin_account_closure($1,$2)", [parent, request]);
}
it("allows only actual Owners to reserve and never creates Owner invitations", async () => {
  await expect(reserve("coach", manager)).rejects.toThrow(/Owner access/);
});
it("rejects an Owner invitation even from the trusted server", async () => {
  await expect(reserve("owner")).rejects.toThrow(/valid adult email/);
});
it("can reopen setup for a verified person with no account level without another email", async () => {
  await newRecipient();
  const result = await reserve();
  expect(result.deliver).toBe(false);
  await as(recipient);
  expect(await value("public.my_account_invitation()")).toMatchObject({
    intended_role: "coach",
    state: "sent",
  });
  await value("public.accept_account_invitation($1,true,true)", [invite]);
  expect(await value("public.my_account_invitation()")).toBeNull();
});
it("binds email and intended role, avoids repeated delivery and completes exact verified adult acceptance", async () => {
  expect((await reserve()).deliver).toBe(true);
  expect((await reserve()).deliver).toBe(false);
  await as("", "postgres");
  await newRecipient();
  await as("", "service_role");
  await value("public.finish_account_invitation($1,$2,'sent')", [
    invite,
    recipient,
  ]);
  await as(recipient);
  expect(
    await value<{ intended_role: string }>("public.my_account_invitation()"),
  ).toMatchObject({ intended_role: "coach" });
  await value("public.accept_account_invitation($1,true,true)", [invite]);
  await value("public.accept_account_invitation($1,true,true)", [invite]);
  expect(await value("public.current_account_role()")).toBe("coach");
  expect(await value("(select count(*) from public.member_accounts)")).toBe(1);
});
it("rejects a different recipient and an unverified invited email", async () => {
  await newRecipient(false);
  await reserve();
  await value("public.finish_account_invitation($1,$2,'sent')", [
    invite,
    recipient,
  ]);
  await as(recipient);
  await expect(
    value("public.accept_account_invitation($1,true,true)", [invite]),
  ).rejects.toThrow(/Verify the invited email/);
});
it("does not activate a cancelled invitation even if its in-flight email finishes", async () => {
  await reserve();
  await as("", "postgres");
  await newRecipient();
  await as(owner);
  await value("public.cancel_account_invitation($1,1)", [invite]);
  await as("", "service_role");
  expect(
    await value("public.finish_account_invitation($1,$2,'sent')", [
      invite,
      recipient,
    ]),
  ).toMatchObject({ state: "cancelled" });
  await as(recipient);
  await expect(
    value("public.complete_member_account('adult',true,true)"),
  ).rejects.toThrow(/active Owner invitation/);
});
it("blocks acceptance after the inviting Owner loses access", async () => {
  await sent();
  await as("", "postgres");
  await db.query(
    "update public.account_roles set role='coach' where user_id=$1",
    [owner],
  );
  await as(recipient);
  await expect(
    value("public.accept_account_invitation($1,true,true)", [invite]),
  ).rejects.toThrow(/inviting Owner/);
});
it("keeps invitations and closure requests hidden from Managers and customers", async () => {
  await as(manager);
  await expect(value("public.list_account_invitations()")).rejects.toThrow(
    /Owner access/,
  );
});
it("preserves the last Owner and all staff accounts through assisted closure", async () => {
  await as(owner);
  expect(await value("public.account_lifecycle_state()")).toMatchObject({
    eligible: false,
    reason: "owner_transfer",
  });
  const help = await value("public.request_account_closure_help()");
  expect(typeof help).toBe("string");
  expect(await value("public.current_account_role()")).toBe("owner");
  await as("", "service_role");
  await expect(
    value("public.begin_account_closure($1,$2)", [owner, request]),
  ).rejects.toThrow(/Assisted account closure/);
});
it("blocks automatic erasure of guardian-managed identities", async () => {
  await db.query(
    "insert into public.guardian_managed_athletes(user_id) values($1)",
    [parent],
  );
  await as(parent);
  expect(await value("public.account_lifecycle_state()")).toMatchObject({
    eligible: false,
    reason: "guardian_review",
  });
});
it("freezes reads, profile writes, role promotion and new media during cleanup", async () => {
  await start();
  await as(parent);
  expect(await value("public.can_view_athlete($1)", [profile])).toBe(false);
  await as("", "postgres");
  await expect(
    db.query(
      "update public.player_profiles set nickname='Changed' where id=$1",
      [profile],
    ),
  ).rejects.toThrow(/deletion is in progress/);
});
it("blocks role promotion during cleanup", async () => {
  await start();
  await as("", "postgres");
  await expect(
    db.query("update public.account_roles set role='coach' where user_id=$1", [
      parent,
    ]),
  ).rejects.toThrow(/deletion is in progress/);
});
it("blocks new media including previously reserved object paths", async () => {
  await start();
  await as("", "postgres");
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values('athlete-review-videos',$1)",
      [path(parent, profile, 40)],
    ),
  ).rejects.toThrow(/deletion is in progress/);
});
it("enumerates only the closing household and that person's submitted clips, including orphaned own paths", async () => {
  await videos();
  await start();
  const paths = await value<string[]>("public.account_closure_media($1)", [
    parent,
  ]);
  expect(paths.sort()).toEqual(
    [
      path(parent, profile, 40),
      path(other, otherProfile, 41),
      path(parent, profile, 43),
    ].sort(),
  );
});
it("refuses data erasure while private stored media remain", async () => {
  await videos();
  await start();
  await expect(
    value("public.clear_account_closure_data($1,$2)", [parent, request]),
  ).rejects.toThrow(/media cleanup has not finished/);
});
it("erases only owned data and clips, removes Auth, and keeps another household intact", async () => {
  await videos();
  await start();
  const paths = await value<string[]>("public.account_closure_media($1)", [
    parent,
  ]);
  await as("", "postgres");
  await db.query(
    "delete from storage.objects where bucket_id='athlete-review-videos' and name=any($1::text[])",
    [paths],
  );
  await as("", "service_role");
  await value("public.clear_account_closure_data($1,$2)", [parent, request]);
  await as("", "postgres");
  await db.query("delete from auth.users where id=$1", [parent]);
  await as("", "service_role");
  await value("public.finish_account_closure($1,false)", [request]);
  await as("", "postgres");
  expect(await value("(select count(*) from public.player_profiles)")).toBe(1);
  expect(
    await value("(select count(*) from public.athlete_video_reviews)"),
  ).toBe(1);
  expect(await value("(select count(*) from storage.objects)")).toBe(1);
  expect(
    await value("(select state from public.account_closures where id=$1)", [
      request,
    ]),
  ).toBe("completed");
  expect(
    await value("(select user_id from public.account_closures where id=$1)", [
      request,
    ]),
  ).toBeNull();
});
it("does not mark deletion complete while the email login still exists", async () => {
  await start();
  await expect(
    value("public.finish_account_closure($1,false)", [request]),
  ).rejects.toThrow(/Authentication deletion/);
});

it("adult names preserve own-row privacy, duplicate Unicode names and exact Owner directory scope", async () => {
  await as(parent);
  await value(`public.save_my_account_name('  José 李  ',0,'${parent}')`);
  await as(other);
  await value(`public.save_my_account_name('José 李',0,'${other}')`);
  expect(
    (await db.query("select user_id,display_name from public.account_names"))
      .rows,
  ).toEqual([{ user_id: other, display_name: "José 李" }]);
  await as(owner);
  const old = (await db.query("select * from public.list_account_access('')"))
    .rows;
  const named = (
    await db.query<Record<string, unknown>>(
      "select * from public.list_account_access_v2('')",
    )
  ).rows;
  expect(
    named.map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "display_name"),
      ),
    ),
  ).toEqual(old);
  expect(named.filter((row) => row.display_name === "José 李")).toHaveLength(2);
  expect((await db.query("select * from public.account_names")).rows).toEqual(
    [],
  );
});
for (const actor of [manager, coach, parent, other]) {
  it(`names do not grant directory access to ${actor}`, async () => {
    await as(actor);
    await expect(
      db.query<Record<string, unknown>>(
        "select * from public.list_account_access_v2('')",
      ),
    ).rejects.toThrow(/Owner access/);
  });
}
it("name edits cannot target another account, write directly, or use stale versions", async () => {
  await as(parent);
  expect(await value("public.get_my_account_name()")).toEqual({
    eligible: true,
    display_name: null,
    version: 0,
  });
  await value(`public.save_my_account_name('Alex',0,'${parent}')`);
  await db.exec("savepoint rejected");
  await expect(
    value(`public.save_my_account_name('Overwrite',0,'${parent}')`),
  ).rejects.toThrow(/another session/);
  await db.exec("rollback to savepoint rejected");
  await expect(
    db.query("update public.account_names set display_name='Other'"),
  ).rejects.toThrow(/permission denied/);
  await db.exec("rollback to savepoint rejected");
  expect(
    await value(`public.save_my_account_name('  ',1,'${parent}')`),
  ).toEqual({
    eligible: true,
    display_name: null,
    version: 2,
  });
});
for (const bad of [
  "a".repeat(101),
  "a\nb",
  "a\tb",
  "a\u007fb",
  "a\u0085b",
  "a\u200fb",
  "a\u2028b",
  "a\u{E0001}b",
]) {
  it(`rejects invalid name ${JSON.stringify(bad.slice(0, 12))}`, async () => {
    await as(parent);
    await expect(
      db.query(`select public.save_my_account_name($1,0,'${parent}')`, [bad]),
    ).rejects.toThrow(/account_name_valid/);
  });
}
it("100 Unicode codepoints fit and account-data erasure cascades names", async () => {
  await as(parent);
  expect(
    (
      await value<{ display_name: string }>(
        `public.save_my_account_name($1,0,'${parent}')`,
        ["😀".repeat(100)],
      )
    ).display_name,
  ).toHaveLength(200);
  await as("", "postgres");
  await db.query("delete from public.member_accounts where user_id=$1", [
    parent,
  ]);
  expect((await db.query("select * from public.account_names")).rows).toEqual(
    [],
  );
});
for (const condition of [
  "unverified",
  "no setup",
  "guardian",
  "closing",
  "failed closure",
]) {
  it(`rejects name saves for ${condition}`, async () => {
    if (condition === "unverified")
      await db.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [parent],
      );
    if (condition === "no setup")
      await db.query("delete from public.member_accounts where user_id=$1", [
        parent,
      ]);
    if (condition === "guardian")
      await db.query(
        "insert into public.guardian_managed_athletes(user_id) values($1)",
        [parent],
      );
    if (condition === "closing" || condition === "failed closure")
      await db.query(
        "insert into public.account_closures(id,user_id,state) values($1,$2,$3)",
        [request, parent, condition === "closing" ? "cleaning" : "failed"],
      );
    await as(parent);
    expect(
      (await value<{ eligible: boolean }>("public.get_my_account_name()"))
        .eligible,
    ).toBe(false);
    await expect(
      value(`public.save_my_account_name('Alex',0,'${parent}')`),
    ).rejects.toThrow(/Verified adult/);
  });
}
it("anonymous users cannot read names or call either name RPC", async () => {
  await as("", "anon");
  for (const sql of [
    "select * from public.account_names",
    "select public.get_my_account_name()",
    `select public.save_my_account_name('Alex',0,'${parent}')`,
    "select * from public.list_account_access_v2('')",
  ]) {
    await db.exec("savepoint denied_name");
    await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    await db.exec("rollback to savepoint denied_name");
  }
});

it("v2 keeps pending accounts, email-only search and the exact 50-account cap", async () => {
  for (let n = 100; n < 160; n++)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,null)",
      [id(n), `pending-${n}@example.test`],
    );
  await as(owner);
  for (const search of ["", "pending-15", "José", "fictional"]) {
    const old = (
      await db.query<Record<string, unknown>>(
        "select * from public.list_account_access($1)",
        [search],
      )
    ).rows;
    const named = (
      await db.query<Record<string, unknown>>(
        "select * from public.list_account_access_v2($1)",
        [search],
      )
    ).rows;
    expect(
      named.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "display_name"),
        ),
      ),
    ).toEqual(old);
    if (search === "") expect(named).toHaveLength(50);
    if (search === "pending-15")
      expect(named.every((row) => row.adult_setup === false)).toBe(true);
  }
});

it("authenticated callers without a user cannot save and no client can invoke eligibility or write names directly", async () => {
  await as("");
  await expect(
    value(`public.save_my_account_name('Fake',0,'${parent}')`),
  ).rejects.toThrow(/Sign in/);
});
it("new privileged functions have fixed search paths and restricted grants", async () => {
  const defs = (
    await db.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[];
    }>(
      "select proname,prosecdef,proconfig from pg_proc where proname in ('get_my_account_name','save_my_account_name','list_account_access_v2','can_save_account_name')",
    )
  ).rows;
  expect(defs).toHaveLength(4);
  for (const fn of defs) {
    expect(fn.prosecdef).toBe(true);
    expect(fn.proconfig).toContain('search_path=""');
    const sig =
      fn.proname +
      (fn.proname === "save_my_account_name"
        ? "(text,integer,uuid)"
        : fn.proname === "list_account_access_v2"
          ? "(text)"
          : "()");
    expect(
      await value("has_function_privilege('anon',$1,'EXECUTE')", [sig]),
    ).toBe(false);
    expect(
      await value("has_function_privilege('authenticated',$1,'EXECUTE')", [
        sig,
      ]),
    ).toBe(fn.proname !== "can_save_account_name");
  }
  expect(
    await value(
      "has_table_privilege('authenticated','public.account_names','INSERT')",
    ),
  ).toBe(false);
  expect(
    await value(
      "has_table_privilege('authenticated','public.account_names','UPDATE')",
    ),
  ).toBe(false);
  expect(
    await value(
      "has_table_privilege('authenticated','public.account_names','DELETE')",
    ),
  ).toBe(false);
});

it("rejects a save from a switched session rather than storing the previous adult's draft", async () => {
  await as(other);
  await expect(
    db.query(
      "select public.save_my_account_name('Previous adult draft',0,$1)",
      [parent],
    ),
  ).rejects.toThrow(/signed-in account changed/);
});

for (const [label, user] of [
  ["Owner", owner],
  ["Manager", manager],
  ["Coach", coach],
] as const) {
  it(`${label} without a member-account consent record stays blocked without backfill or role changes`, async () => {
    const before = (
      await db.query("select * from public.account_roles where user_id=$1", [
        user,
      ])
    ).rows;
    await as(user);
    expect(await value("public.get_my_account_name()")).toEqual({
      eligible: false,
      display_name: null,
      version: 0,
    });
    await db.exec("savepoint blocked_staff_name");
    await expect(
      db.query("select public.save_my_account_name('Cannot save',0,$1)", [
        user,
      ]),
    ).rejects.toThrow(/Verified adult setup/);
    await db.exec("rollback to savepoint blocked_staff_name");
    expect(
      (await db.query("select * from public.member_accounts")).rows,
    ).toEqual([]);
    expect((await db.query("select * from public.account_names")).rows).toEqual(
      [],
    );
    expect(
      (
        await db.query("select * from public.account_roles where user_id=$1", [
          user,
        ])
      ).rows,
    ).toEqual(before);
  });
}

it("names remain ineligible if a drifted member record has no privacy acknowledgement", async () => {
  // Simulate unexpected legacy metadata in this disposable fixture only.
  await db.exec(
    "alter table public.member_accounts alter column privacy_acknowledged_at drop not null",
  );
  await db.query(
    "update public.member_accounts set privacy_acknowledged_at=null where user_id=$1",
    [parent],
  );
  await as(parent);
  expect(
    (await value<{ eligible: boolean }>("public.get_my_account_name()"))
      .eligible,
  ).toBe(false);
  await expect(
    db.query("select public.save_my_account_name('No consent',0,$1)", [parent]),
  ).rejects.toThrow(/Verified adult setup/);
});
