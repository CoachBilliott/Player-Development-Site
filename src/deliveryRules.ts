import { z } from "zod";
export const deliveryRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return !!v;
      } catch {
        return false;
      }
    }, "Choose a valid IANA time zone."),
    grace_minutes: z.number().int().min(0).max(10080),
    escalation_minutes: z.number().int().min(0).max(10080),
    routing: z.enum(["assigned_coach", "owners_managers"]),
    notify_training: z.boolean(),
    notify_reviews: z.boolean(),
    email_requested: z.boolean(),
    submission_reminders: z.literal(false),
    submission_cadence_hours: z.number().int().min(1).max(168).optional(),
    submission_expectation: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export type DeliveryRule = z.infer<typeof deliveryRuleSchema>;
/** Defaults are draft form values, never a package or activation. */
export const draftDeliveryRule: DeliveryRule = {
  weekday: 0,
  time: "08:00",
  timezone: "America/Chicago",
  grace_minutes: 60,
  escalation_minutes: 120,
  routing: "assigned_coach",
  notify_training: true,
  notify_reviews: true,
  email_requested: false,
  submission_reminders: false,
};
export function effectiveDeliveryRule(
  base: DeliveryRule,
  client: Partial<DeliveryRule>,
  athlete: Partial<DeliveryRule>,
): DeliveryRule {
  return deliveryRuleSchema.parse({ ...base, ...client, ...athlete });
}
export function localDeliveryInstant(date: string, rule: DeliveryRule): Date {
  const valid = deliveryRuleSchema.parse(rule);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Choose a valid date.");
  const [y, m, d] = date.split("-").map(Number),
    [h, min] = valid.time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min),
    calendar = new Date(wall);
  if (
    calendar.getUTCFullYear() !== y ||
    calendar.getUTCMonth() !== m - 1 ||
    calendar.getUTCDate() !== d ||
    calendar.getUTCDay() !== valid.weekday
  )
    throw new Error("Choose a date matching the configured due day.");
  const f = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: valid.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const value = (t: number) => {
    const p = Object.fromEntries(
      f.formatToParts(t).map((v) => [v.type, v.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const t = wall + hours * 3600000;
      return value(t) - t;
    }),
  );
  const candidates = [...offsets]
    .map((o) => wall - o)
    .filter((t) => value(t) === wall);
  if (candidates.length !== 1)
    throw new Error(
      "That local time is skipped or repeated by a clock change. Choose another time.",
    );
  return new Date(candidates[0]);
}
/** Never dispatches external email. Simulation reports must remain labeled TEST. */
export async function testEmailAdapter(
  mode: "disabled" | "test",
  outcome: "sent" | "failed" = "sent",
) {
  return mode === "disabled"
    ? { status: "disabled" as const, external_send: false as const }
    : {
        status: outcome,
        external_send: false as const,
        simulated: true as const,
      };
}
