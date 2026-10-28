import type { InterestSubmission } from "./interestContract";
export async function sendInterest(
  endpoint: string,
  input: InterestSubmission,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
      credentials: "omit",
    });
    const data = await response.json().catch(() => null);
    if (
      response.status === 202 &&
      data?.status === "accepted" &&
      data.reference === input.id
    )
      return;
    if (response.status === 429)
      throw new Error(
        "The form is temporarily limiting requests. Please try later or email us directly.",
      );
    if (response.status === 400)
      throw new Error(
        "Check your adult contact details and package choice, then try again.",
      );
    throw new Error(
      "We could not confirm receipt. Your details remain here; retrying the same request is safe, or email us directly.",
    );
  } catch (e) {
    if (
      e instanceof TypeError ||
      (e instanceof Error && e.name === "AbortError")
    )
      throw new Error(
        "We could not confirm receipt. Your details remain here; retrying the same request is safe, or email us directly.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
