import { it, expect } from "vitest";
import type { Setup } from "./staffOperationalCases";
import { LAUNCH_NOTICE_TEXT, LAUNCH_NOTICE_VERSION } from "../interestContract";
export function interestPolicyCases(f: Setup) {
  const db = f.db;
  async function admin() {
    await f.as("", "postgres");
  }
  async function service() {
    await f.as("", "service_role");
  }
  async function scalar<T>(sql: string, args: unknown[] = []) {
    return (await db().query<{ v: T }>(sql, args)).rows[0].v;
  }
  async function reject(
    sql: string,
    args: unknown[] = [],
    pattern = /permission|access|routing|check|invalid/i,
  ) {
    await db().exec("savepoint interest_reject");
    await expect(db().query(sql, args)).rejects.toThrow(pattern);
    await db().exec("rollback to savepoint interest_reject");
  }
  async function enable(email = true) {
    await admin();
    await db().exec("update public.interest_intake_settings set enabled=true");
    await db().query(
      "update public.staff_notification_settings set email_enabled=$1",
      [email],
    );
    await service();
  }
  async function submit(
    n = 400,
    email = "adult@example.test",
    choice = "undecided",
    name = "",
    adult = true,
    launch = false,
    version: string | null = null,
  ) {
    await service();
    return scalar<{ status: string }>(
      "select public.accept_public_interest($1,$2,$3,$4,$5,$6,$7) as v",
      [f.id(n), name, email, choice, adult, launch, version],
    );
  }
  it("keeps intake off and denies anonymous/member raw data, intake RPC and settings writes", async () => {
    expect((await submit()).status).toBe("disabled");
    for (const [actor, role] of [
      ["", "anon"],
      [f.parent, "authenticated"],
      [f.coach, "authenticated"],
      [f.owner, "authenticated"],
    ]) {
      await f.as(actor, role);
      await reject("select * from public.interest_requests");
      await reject("update public.interest_intake_settings set enabled=true");
      await reject(
        "select public.accept_public_interest($1,'','adult@example.test','undecided',true)",
        [f.id(400)],
      );
    }
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(0);
  });
  it("persists one adult request and one fixed-inbox alert across retries and duplicate clicks", async () => {
    await enable();
    expect(
      (
        await submit(
          400,
          " Adult@Example.Test ",
          "foundation",
          "Fictional Adult",
        )
      ).status,
    ).toBe("accepted");
    expect(
      (await submit(400, "adult@example.test", "foundation", "Fictional Adult"))
        .status,
    ).toBe("accepted");
    expect(
      (await submit(401, "adult@example.test", "foundation", "Another name"))
        .status,
    ).toBe("accepted");
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(1);
    const requests = (
      await db().query<{ adult_name: string; contact_email: string }>(
        "select adult_name,contact_email from public.interest_requests",
      )
    ).rows;
    expect(requests).toEqual([
      { adult_name: "Fictional Adult", contact_email: "adult@example.test" },
    ]);
    const jobs = (
      await db().query(
        "select recipient_email,recipient_id,profile_id,route,kind from public.staff_notification_jobs",
      )
    ).rows;
    expect(jobs).toEqual([
      {
        recipient_email: "Repformed@gmail.com",
        recipient_id: null,
        profile_id: null,
        route: "shared_inbox",
        kind: "interest_received",
      },
    ]);
  });
  it("rejects changed idempotency payload without overwriting accepted contact details", async () => {
    await enable();
    await submit();
    expect((await submit(400, "different@example.test")).status).toBe(
      "conflict",
    );
    await admin();
    expect(
      await scalar<string>(
        "select contact_email as v from public.interest_requests",
      ),
    ).toBe("adult@example.test");
  });
  it("requires adult declaration, constrained fields and valid package even at the service RPC", async () => {
    await enable();
    for (const [name, email, choice, adult] of [
      ["", "adult@example.test", "undecided", false],
      ["", "invalid", "undecided", true],
      ["", "adult@example.test", "unapproved-package", true],
      ["x".repeat(61), "adult@example.test", "foundation", true],
      ["Bad\nName", "adult@example.test", "foundation", true],
    ] as const)
      await reject("select public.accept_public_interest($1,$2,$3,$4,$5)", [
        f.id(400),
        name,
        email,
        choice,
        adult,
      ]);
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(0);
  });
  it("bounds new intake globally and per normalized email while allowing harmless retries", async () => {
    await enable(false);
    await admin();
    await db().exec(
      "update public.interest_intake_settings set window_limit=2,email_daily_limit=2",
    );
    expect((await submit(400, "one@example.test", "foundation")).status).toBe(
      "accepted",
    );
    expect((await submit(401, "one@example.test", "fundamentals")).status).toBe(
      "accepted",
    );
    expect((await submit(402, "two@example.test")).status).toBe("rate_limited");
    expect((await submit(400, "ONE@example.test", "foundation")).status).toBe(
      "accepted",
    );
    await admin();
    await db().exec(
      "update public.interest_intake_settings set window_started_at=clock_timestamp()-interval '11 minutes'",
    );
    expect(
      (await submit(404, "one@example.test", "elite-coaching")).status,
    ).toBe("rate_limited");
    expect((await submit(405, "two@example.test")).status).toBe("accepted");
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(3);
  });
  it("keeps saved interest when staff email fails and exposes contact only to verified Owners/Managers", async () => {
    await enable();
    await submit(400, "adult@example.test", "undecided", "Fictional Adult");
    const jobs = await scalar<Array<{ id: string; lease_token: string }>>(
      "select public.claim_staff_notification_jobs(1) as v",
    );
    expect(jobs).toHaveLength(1);
    await db().query(
      "select public.finish_staff_notification_job($1,$2,'retry','provider_unavailable',null,60)",
      [jobs[0].id, jobs[0].lease_token],
    );
    for (const actor of [f.owner, f.manager]) {
      await f.as(actor);
      const inbox = await scalar<
        Array<{ adult_name: string; email: string; email_state: string }>
      >("select public.interest_staff_inbox() as v");
      expect(inbox[0]).toMatchObject({
        adult_name: "Fictional Adult",
        email: "adult@example.test",
        email_state: "retry",
      });
    }
    for (const actor of [f.coach, f.parent, f.otherParent]) {
      await f.as(actor);
      await reject(
        "select public.interest_staff_inbox()",
        [],
        /Owner or Manager/,
      );
    }
    await f.as(f.coach);
    const scope = await scalar<{ jobs: unknown[] }>(
      "select public.staff_notification_workspace() as v",
    );
    expect(scope.jobs).toEqual([]);
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(1);
    await db().query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [f.manager],
    );
    await f.as(f.manager);
    await reject(
      "select public.interest_staff_inbox()",
      [],
      /Owner or Manager/,
    );
  });
  it("does not backfill interest accepted while staff email was off or create customer accounts", async () => {
    await enable(false);
    await admin();
    const count = await scalar<number>(
      "select count(*)::integer as v from auth.users",
    );
    await submit();
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.staff_notification_jobs",
      ),
    ).toBe(0);
    await db().exec(
      "update public.staff_notification_settings set email_enabled=true",
    );
    await service();
    expect(
      await scalar<number>(
        "select public.prepare_staff_notification_jobs(10) as v",
      ),
    ).toBe(0);
    await submit(401, "new@example.test");
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.staff_notification_jobs",
      ),
    ).toBe(1);
    expect(
      await scalar<number>("select count(*)::integer as v from auth.users"),
    ).toBe(count);
  });
  it("leases only the submitted request, suppresses duplicate attempts and retains safe retry accounting", async () => {
    await enable();
    await submit(400, "one@example.test");
    await submit(401, "two@example.test");
    const first = await scalar<{
      id: string;
      lease_token: string;
      recipient_email: string;
    } | null>("select public.claim_interest_notification($1) as v", [
      f.id(400),
    ]);
    expect(first?.recipient_email).toBe("Repformed@gmail.com");
    expect(
      await scalar("select public.claim_interest_notification($1) as v", [
        f.id(400),
      ]),
    ).toBeNull();
    await db().query(
      "select public.finish_staff_notification_job($1,$2,'accepted','provider_accepted','provider_test',60)",
      [first!.id, first!.lease_token],
    );
    expect(
      await scalar("select public.claim_interest_notification($1) as v", [
        f.id(400),
      ]),
    ).toBeNull();
    await admin();
    const queued = await scalar<number>(
      "select count(*)::integer as v from public.staff_notification_jobs where state='queued'",
    );
    expect(queued).toBe(1);
    await f.as(f.parent);
    await reject("select public.claim_interest_notification($1)", [f.id(401)]);
  });
  it("records optional launch choice with authoritative text/version/time and preserves unchecked history", async () => {
    await enable(false);
    expect(
      (
        await submit(
          400,
          "adult@example.test",
          "undecided",
          "Adult",
          true,
          false,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("accepted");
    expect(
      (
        await submit(
          401,
          "adult@example.test",
          "undecided",
          "Adult",
          true,
          true,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("accepted");
    expect(
      (
        await submit(
          401,
          "adult@example.test",
          "undecided",
          "Adult",
          true,
          true,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("accepted");
    expect(
      (
        await submit(
          402,
          "adult@example.test",
          "undecided",
          "Adult",
          true,
          false,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("accepted");
    await admin();
    const history = (
      await db().query<{
        launch_requested: boolean;
        notice_text: string;
        notice_version: string;
        recorded_at: Date;
      }>(
        "select launch_requested,notice_text,notice_version,recorded_at from public.interest_submission_events order by recorded_at",
      )
    ).rows;
    expect(history.map((e) => e.launch_requested)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      history.every(
        (e) =>
          e.notice_text === LAUNCH_NOTICE_TEXT &&
          e.notice_version === LAUNCH_NOTICE_VERSION &&
          Boolean(e.recorded_at),
      ),
    ).toBe(true);
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_requests",
      ),
    ).toBe(1);
    await f.as(f.owner);
    const rows = await scalar<
      Array<{
        launch_choice: boolean;
        launch_requested_at: string;
        launch_notice_version: string;
      }>
    >("select public.interest_staff_inbox() as v");
    expect(rows[0].launch_choice).toBe(false);
    expect(rows[0].launch_requested_at).toBeTruthy();
    expect(rows[0].launch_notice_version).toBe(LAUNCH_NOTICE_VERSION);
    await f.as(f.parent);
    await reject("select * from public.interest_submission_events");
    await f.as(f.coach);
    await reject(
      "select public.interest_staff_inbox()",
      [],
      /Owner or Manager/,
    );
  });
  it("does not backfill launch permission for legacy requests or accept changed/stale notice payloads", async () => {
    await enable(false);
    await admin();
    await db().query(
      "insert into public.interest_requests(id,adult_name,contact_email,package_interest) values($1,'','legacy@example.test','undecided')",
      [f.id(450)],
    );
    await f.as(f.owner);
    const original = await scalar<
      Array<{
        launch_choice: boolean | null;
        launch_requested_at: string | null;
      }>
    >("select public.interest_staff_inbox() as v");
    expect(original[0]).toMatchObject({
      launch_choice: null,
      launch_requested_at: null,
    });
    expect((await submit(450, "legacy@example.test")).status).toBe("accepted");
    expect(
      (
        await submit(
          450,
          "legacy@example.test",
          "undecided",
          "",
          true,
          true,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("conflict");
    await admin();
    expect(
      await scalar<number>(
        "select count(*)::integer as v from public.interest_submission_events",
      ),
    ).toBe(0);
    await service();
    await reject(
      "select public.accept_public_interest($1,'','adult@example.test','undecided',true,true,'untrusted-version')",
      [f.id(451)],
    );
    await submit(
      451,
      "adult@example.test",
      "undecided",
      "",
      true,
      true,
      LAUNCH_NOTICE_VERSION,
    );
    expect(
      (
        await submit(
          451,
          "adult@example.test",
          "undecided",
          "",
          true,
          false,
          LAUNCH_NOTICE_VERSION,
        )
      ).status,
    ).toBe("conflict");
  });
  it("keeps broad recipient routing disabled and queues overdue delivery only for the shared inbox", async () => {
    await f.configure();
    await f.workout();
    await f.plan();
    await enable();
    await admin();
    await reject(
      "update public.staff_notification_settings set routing_mode='owners_managers'",
    );
    await db().query(
      "update public.delivery_expectations set due_at=clock_timestamp(),rule_snapshot=jsonb_set(rule_snapshot,'{grace_minutes}','0') where id=$1",
      [f.id(81)],
    );
    await service();
    expect(
      await scalar<number>(
        "select public.prepare_staff_notification_jobs(10) as v",
      ),
    ).toBe(1);
    expect(
      await scalar<number>(
        "select public.prepare_staff_notification_jobs(10) as v",
      ),
    ).toBe(0);
    const jobs = await scalar<Array<{ recipient_email: string }>>(
      "select public.claim_staff_notification_jobs(10) as v",
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].recipient_email).toBe("Repformed@gmail.com");
    await f.as(f.owner);
    await reject(
      "select public.set_staff_notification_opt_out(true)",
      [],
      /Shared inbox/,
    );
  });
}
