import { it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
type Setup = {
  db: () => PGlite;
  as: (actor?: string, role?: string) => Promise<void>;
  id: (n: number) => string;
  owner: string;
  manager: string;
  coach: string;
  parent: string;
  otherParent: string;
  profile: string;
  sibling: string;
  first: string;
  configure: () => Promise<void>;
  workout: () => Promise<void>;
  assignWorkout: () => Promise<void>;
  plan: () => Promise<void>;
  media: () => Promise<void>;
  notices: (
    actor?: string,
  ) => Promise<{ id: string; kind: string; email_status: string }[]>;
};
type Job = {
  id: string;
  lease_token: string;
  recipient_email: string;
  idempotency_key: string;
};
export function staffOperationalCases(f: Setup) {
  const db = f.db;
  async function value<T>(sql: string, args: unknown[] = []) {
    return (await db().query<{ v: T }>(sql, args)).rows[0]?.v;
  }
  async function service() {
    await f.as("", "service_role");
  }
  async function rejected(
    sql: string,
    args: unknown[] = [],
    pattern = /permission|access|configured|source|check|lease/i,
  ) {
    await db().exec("savepoint reject_staff");
    await expect(db().query(sql, args)).rejects.toThrow(pattern);
    await db().exec("rollback to savepoint reject_staff");
  }
  async function enable(email = true, inapp = false) {
    await f.as("", "postgres");
    await db().query(
      "update public.staff_notification_settings set email_enabled=$1,inapp_observation_enabled=$2",
      [email, inapp],
    );
    for (const who of [f.owner, f.manager, f.coach])
      await db().query(
        "insert into public.staff_notification_recipients(user_id,selected) values($1,true)",
        [who],
      );
  }
  async function missedTraining() {
    await f.configure();
    await f.workout();
    await f.plan();
    await enable();
    await db().query(
      "update public.delivery_expectations set due_at=clock_timestamp(),notice_not_before=clock_timestamp()-interval '1 second',rule_snapshot=jsonb_set(rule_snapshot,'{grace_minutes}','0') where id=$1",
      [f.id(81)],
    );
  }
  async function prepare() {
    await service();
    return value<number>("select public.prepare_staff_notification_jobs(10) v");
  }
  async function claim() {
    await service();
    return (await value<Job[]>(
      "select public.claim_staff_notification_jobs(10) v",
    ))!;
  }
  async function workspace(who = f.owner) {
    await f.as(who);
    return (await value<{
      signup_status: string;
      email_enabled: boolean;
      jobs: { id: string; state: string; code: string }[];
    }>("select public.staff_notification_workspace() v"))!;
  }
  it("keeps all new sending/observation off, has no signup source, and denies raw/service APIs to clients", async () => {
    await service();
    expect(
      await value("select public.prepare_staff_notification_jobs(10) v"),
    ).toBe(0);
    expect(await claim()).toEqual([]);
    expect((await workspace()).email_enabled).toBe(false);
    expect((await workspace()).signup_status).toBe("unconfigured");
    for (const who of [f.owner, f.manager, f.coach, f.parent, f.otherParent]) {
      await f.as(who);
      await rejected("select public.prepare_staff_notification_jobs(10)");
      await rejected("select * from public.staff_notification_jobs");
    }
    await f.as(f.parent);
    await rejected(
      "select public.staff_notification_workspace()",
      [],
      /Staff access/,
    );
    await f.as("", "postgres");
    await rejected(
      "update public.staff_notification_settings set signup_source='account_registered'",
    );
  });
  it("deduplicates overdue training, routes to selected assigned staff and never to a client", async () => {
    await missedTraining();
    await db().query(
      "insert into public.staff_notification_recipients(user_id,selected) values($1,true)",
      [f.parent],
    );
    expect(await prepare()).toBe(1);
    expect(await prepare()).toBe(0);
    const [job] = await claim();
    expect(job.recipient_email).toBe("fictional-workout-3@example.test");
    expect(job.idempotency_key).toBe(`repformed-staff/${job.id}/v1`);
    expect(await claim()).toEqual([]);
    await service();
    await db().query(
      "select public.finish_staff_notification_job($1,$2,'accepted','provider_accepted','provider_123',60)",
      [job.id, job.lease_token],
    );
    expect(await claim()).toEqual([]);
    expect((await workspace()).jobs[0].state).toBe("accepted");
    await f.as(f.otherParent);
    expect(await f.notices(f.otherParent)).toEqual([]);
  });
  it("suppresses resolved, paused, revoked or reassigned jobs before transport and limits coach visibility", async () => {
    await missedTraining();
    await prepare();
    const [job] = await claim();
    await f.as(f.owner);
    await db().query("select public.assign_athlete_service_coach($1,$2,1)", [
      f.profile,
      f.id(4),
    ]);
    await service();
    expect(
      await value("select public.authorize_staff_notification_job($1,$2) v", [
        job.id,
        job.lease_token,
      ]),
    ).toBe(false);
    expect((await workspace(f.coach)).jobs).toEqual([]);
    expect((await workspace(f.manager)).jobs).toHaveLength(1);
    await f.as("", "postgres");
    await db().exec(
      "update public.delivery_client_settings set state='paused'",
    );
    expect(await prepare()).toBe(0);
  });
  it("supports staff opt-out with verified staff fallback; parents cannot enroll themselves as recipients", async () => {
    await missedTraining();
    await f.as(f.coach);
    await db().query("select public.set_staff_notification_opt_out(true)");
    expect(await prepare()).toBe(2);
    const jobs = await claim();
    expect(jobs.map((j) => j.recipient_email).sort()).toEqual([
      "fictional-workout-1@example.test",
      "fictional-workout-2@example.test",
    ]);
    await f.as(f.parent);
    await rejected("select public.set_staff_notification_opt_out(false)");
  });
  it("does not backfill historical misses or change its activation cutoff on a backdating attempt", async () => {
    await missedTraining();
    await f.as("", "postgres");
    const cutoff = await value(
      "select email_since::text v from public.staff_notification_settings",
    );
    await db().exec(
      "update public.staff_notification_settings set email_since=clock_timestamp()-interval '5 days';update public.delivery_expectations set due_at=clock_timestamp()-interval '1 day',notice_not_before=clock_timestamp()-interval '2 days'",
    );
    expect(
      await value(
        "select email_since::text v from public.staff_notification_settings",
      ),
    ).toBe(cutoff);
    expect(await prepare()).toBe(0);
  });
  it("uses stable retry keys/leases, stops after the duplicate-protection window and rejects stale outcomes", async () => {
    await missedTraining();
    await prepare();
    const [first] = await claim();
    await service();
    await db().query(
      "select public.finish_staff_notification_job($1,$2,'retry','provider_unavailable',null,60)",
      [first.id, first.lease_token],
    );
    await f.as("", "postgres");
    await db().exec(
      "update public.staff_notification_jobs set next_attempt_at=clock_timestamp()-interval '1 second'",
    );
    const [second] = await claim();
    expect(second.idempotency_key).toBe(first.idempotency_key);
    expect(second.lease_token).not.toBe(first.lease_token);
    await service();
    await rejected(
      "select public.finish_staff_notification_job($1,$2,'accepted','provider_accepted','provider_1',60)",
      [first.id, first.lease_token],
      /lease changed/,
    );
    await f.as("", "postgres");
    await db().exec(
      "update public.staff_notification_jobs set lease_until=clock_timestamp()-interval '1 second',first_attempt_at=clock_timestamp()-interval '24 hours'",
    );
    expect(await claim()).toEqual([]);
    expect((await workspace()).jobs[0].state).toBe("uncertain");
  });
  it("creates new in-app notices only for approved accessible assignments and never queues client email", async () => {
    await f.configure();
    await f.workout();
    await f.plan();
    await enable(false, true);
    await db().exec(
      "update public.delivery_expectations set due_at=clock_timestamp()+interval '1 hour',notice_not_before=clock_timestamp()",
    );
    await service();
    expect(await value("select public.observe_new_content_notices(10) v")).toBe(
      0,
    );
    await f.assignWorkout();
    await f.media();
    await f.as("", "postgres");
    await db().query(
      "update public.training_resources set review_stage='draft',status='draft' where id=$1",
      [f.first],
    );
    await service();
    expect(await value("select public.observe_new_content_notices(10) v")).toBe(
      0,
    );
    await f.as("", "postgres");
    await db().query(
      "update public.training_resources set review_stage='approved',status='published' where id=$1",
      [f.first],
    );
    // Republishing changes the content version. The original expectation must
    // stay unavailable until staff plan the exact newly approved version.
    expect(
      await value(
        "select public.delivery_check_available(e) v from public.delivery_expectations e where id=$1",
        [f.id(81)],
      ),
    ).toBe(false);
    await f.as(f.owner);
    await db().query(
      "select public.plan_delivery_check($1,$2,'new-approved-version',$3,1,current_date-extract(dow from current_date)::integer+7,clock_timestamp())",
      [f.id(82), f.profile, f.id(20)],
    );
    await service();
    expect(await value("select public.observe_new_content_notices(10) v")).toBe(
      1,
    );
    expect(await value("select public.observe_new_content_notices(10) v")).toBe(
      0,
    );
    expect((await f.notices()).map((n) => [n.kind, n.email_status])).toEqual([
      ["training_ready", "disabled"],
    ]);
    expect(await f.notices(f.otherParent)).toEqual([]);
    expect(await prepare()).toBe(0);
  });
  it("only alerts staff for overdue ready-for-coach reviews and makes finished feedback an in-app event", async () => {
    await f.configure();
    await enable(true, true);
    await f.as("", "postgres");
    const video = f.id(85),
      path = `${f.parent}/${f.profile}/${video}.mp4`;
    await db().query(
      "insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds,status) values($1,$2,$3,$3,$4,'Synthetic drill',$5,'video/mp4',1000,30,'queued')",
      [video, f.profile, f.parent, f.first, path],
    );
    await db().query(
      'insert into storage.objects(bucket_id,name,metadata) values(\'athlete-review-videos\',$1,\'{"size":1000,"mimetype":"video/mp4"}\')',
      [path],
    );
    await db().exec(
      "update public.review_services set due_at=clock_timestamp()",
    );
    expect(await prepare()).toBe(1);
    const [job] = await claim();
    await f.as(f.coach);
    await db().query(
      "select public.save_athlete_video_feedback($1,'Synthetic private feedback',1)",
      [video],
    );
    await f.as("", "postgres");
    await db().exec(
      "update public.review_services set delivered_at=clock_timestamp()",
    );
    await service();
    expect(
      await value("select public.authorize_staff_notification_job($1,$2) v", [
        job.id,
        job.lease_token,
      ]),
    ).toBe(false);
    expect(await value("select public.observe_new_content_notices(10) v")).toBe(
      1,
    );
    expect((await f.notices()).map((n) => n.kind)).toEqual(["review_ready"]);
  });
  it.each(["role_revoked", "email_unverified", "address_changed"] as const)(
    "suppresses a queued staff job after %s",
    async (change) => {
      await missedTraining();
      await prepare();
      await f.as("", "postgres");
      if (change === "role_revoked")
        await db().query(
          "update public.account_roles set role='parent' where user_id=$1",
          [f.coach],
        );
      if (change === "email_unverified")
        await db().query(
          "update auth.users set email_confirmed_at=null where id=$1",
          [f.coach],
        );
      if (change === "address_changed")
        await db().query(
          "update auth.users set email='changed-staff@example.test' where id=$1",
          [f.coach],
        );
      expect(await claim()).toEqual([]);
      expect((await workspace()).jobs[0].state).toBe("suppressed");
      if (change !== "address_changed") {
        await f.as(f.coach);
        await rejected(
          "select public.staff_notification_workspace()",
          [],
          /Staff access/,
        );
      }
    },
  );
  it("does not email staff once the required training becomes accessible", async () => {
    await missedTraining();
    await prepare();
    await f.assignWorkout();
    await f.media();
    expect(await claim()).toEqual([]);
    expect((await workspace()).jobs[0].state).toBe("suppressed");
  });
  it("keeps future grace periods out of the staff outbox", async () => {
    await missedTraining();
    await f.as("", "postgres");
    await db().exec(
      "update public.delivery_expectations set rule_snapshot=jsonb_set(rule_snapshot,'{grace_minutes}','60')",
    );
    expect(await prepare()).toBe(0);
    expect((await workspace()).jobs).toEqual([]);
  });
  it("stops automatic retries at the attempt cap without granting another send", async () => {
    await missedTraining();
    await prepare();
    await claim();
    await f.as("", "postgres");
    await db().exec(
      "update public.staff_notification_jobs set attempts=4,lease_until=clock_timestamp()-interval '1 second'",
    );
    expect(await claim()).toEqual([]);
    expect((await workspace()).jobs[0]).toMatchObject({
      state: "failed",
      code: "attempt_limit",
    });
  });
  it("does not email staff for unsubmitted or incomplete review media", async () => {
    await f.configure();
    await enable();
    await f.as("", "postgres");
    await db().query(
      "insert into public.review_services(id,account_id,profile_id,requested_by,state,ready_at,due_at) values($1,$2,$3,$2,'uploading',clock_timestamp(),clock_timestamp())",
      [f.id(92), f.parent, f.profile],
    );
    expect(await prepare()).toBe(0);
    await f.as("", "postgres");
    await db().query(
      "update public.review_services set state='queued' where id=$1",
      [f.id(92)],
    );
    expect(await prepare()).toBe(0);
    expect((await workspace()).jobs).toEqual([]);
  });
}
