/** Preview only. Scheduling never publishes content or overrides access/review gates. */
export function sundayReleaseInstant(
  localDate: string,
  localTime: string,
  timeZone: string,
): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)
  )
    throw new Error("Choose a valid Sunday date and 24-hour release time.");
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const calendar = new Date(wall);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    calendar.getUTCDay() !== 0
  )
    throw new Error("Choose a valid Sunday date.");
  let formatter: Intl.DateTimeFormat;
  try {
    if (!timeZone.trim()) throw new Error();
    formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Choose a valid IANA time zone.");
  }
  const parts = (instant: number) => {
    const fields = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    return Date.UTC(
      Number(fields.year),
      Number(fields.month) - 1,
      Number(fields.day),
      Number(fields.hour),
      Number(fields.minute),
    );
  };
  // Offsets on both sides of a transition identify skipped and repeated local times.
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const instant = wall + hours * 3600000;
      return parts(instant) - instant;
    }),
  );
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => parts(instant) === wall);
  if (!candidates.length)
    throw new Error(
      "That local time does not exist because of a clock change. Choose another time.",
    );
  if (candidates.length !== 1)
    throw new Error(
      "That local time occurs twice because of a clock change. Choose an unambiguous time.",
    );
  return new Date(candidates[0]);
}

export function releaseTimeReached(now: Date, releaseAt: Date): boolean {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(releaseAt.getTime()))
    throw new Error("A valid current time and release instant are required.");
  return now.getTime() >= releaseAt.getTime();
}
