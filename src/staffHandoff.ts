import { z } from "zod";
const key = "pd-staff-next-step";
const schema = z.object({
  actor: z.string().uuid(),
  resource: z.string().uuid(),
  purpose: z.enum(["workout", "editor"]),
  at: z.number(),
});
let memory: z.infer<typeof schema> | null = null;
export function staffHandoff(
  actor: string,
  resource: string,
  purpose: "workout" | "editor",
) {
  memory = schema.parse({ actor, resource, purpose, at: Date.now() });
  try {
    sessionStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* Same-screen navigation still works in memory. */
  }
}
export function takeStaffHandoff(
  actor: string,
  purpose: "workout" | "editor",
  consume = true,
): string | null {
  let value = memory;
  try {
    const parsed = schema.safeParse(
      JSON.parse(sessionStorage.getItem(key) || "null"),
    );
    if (parsed.success) value = parsed.data;
  } catch {
    /* Never infer an actor or resource from unreadable storage. */
  }
  if (!value) return null;
  if (
    value.actor !== actor ||
    Date.now() - value.at > 60 * 60 * 1000 ||
    value.at > Date.now()
  ) {
    memory = null;
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* No content is stored here. */
    }
    return null;
  }
  if (value.purpose !== purpose) return null;
  if (consume) {
    memory = null;
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* In-memory handoff is consumed. */
    }
  }
  return value.resource;
}
