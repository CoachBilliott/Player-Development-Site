export const LEARNING_ZONE = "America/Chicago";
export const LEARNING_DEFAULTS = {
  releaseDay: 0,
  releaseTime: "00:00",
  reminderDay: 5,
  reminderTime: "17:00",
  lowReadyWeeks: 2,
  orientationImmediately: true,
  firstWeek: "next_sunday",
} as const;
function local(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: LEARNING_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return {
    year: +values.year,
    month: +values.month,
    day: +values.day,
    hour: +values.hour,
    minute: +values.minute,
    second: +values.second,
  };
}
export function chicagoInstant(day: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw Error("Choose a valid local date and 24-hour time.");
  const [year, month, date] = day.split("-").map(Number),
    [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  let guess = wall;
  for (let i = 0; i < 4; i++) {
    const p = local(new Date(guess)),
      seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wall - seen;
  }
  const p = local(new Date(guess));
  if (
    p.year !== year ||
    p.month !== month ||
    p.day !== date ||
    p.hour !== hour ||
    p.minute !== minute
  )
    throw Error("That local clock does not exist.");
  return new Date(guess);
}
function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function sundayStart(now: Date) {
  const p = local(now),
    d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return chicagoInstant(dayString(d), "00:00");
}
export function nextSunday(now: Date) {
  const start = sundayStart(now),
    p = local(start),
    d = new Date(Date.UTC(p.year, p.month - 1, p.day + 7));
  return chicagoInstant(dayString(d), "00:00");
}
export function fridayReminder(
  releasedAt: Date,
  clock: string = LEARNING_DEFAULTS.reminderTime,
) {
  const start = sundayStart(releasedAt),
    p = local(start),
    d = new Date(Date.UTC(p.year, p.month - 1, p.day + 5));
  return chicagoInstant(dayString(d), clock);
}
export function reminderIsDue(input: {
  now: Date;
  releasedAt: Date;
  clock?: string;
  paused: boolean;
  accessActive: boolean;
  learnerDone: boolean;
  alreadyNotified: boolean;
}) {
  if (
    input.paused ||
    !input.accessActive ||
    input.learnerDone ||
    input.alreadyNotified
  )
    return false;
  const due = fridayReminder(input.releasedAt, input.clock);
  return (
    input.releasedAt < due &&
    input.now >= due &&
    input.now <
      chicagoInstant(
        dayString(
          new Date(
            Date.UTC(local(due).year, local(due).month - 1, local(due).day + 1),
          ),
        ),
        "00:00",
      )
  );
}
