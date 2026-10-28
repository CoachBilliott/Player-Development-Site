import {
  parseInterestSubmission,
  type InterestSubmission,
} from "../../../src/interestContract.ts";
export type IntakeResult = {
  status: "accepted" | "disabled" | "rate_limited" | "conflict";
  dispatchId?: string;
};
export type InterestBackend = {
  accept(input: InterestSubmission): Promise<IntakeResult>;
};
const origins = new Set([
  "https://repformed.com",
  "https://repformed.pages.dev",
]);
async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 4096) throw new Error();
  const reader = request.body?.getReader();
  if (!reader) throw new Error();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4096) {
      await reader.cancel();
      throw new Error();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
}
/** Public HTTP intake only. All persistence uses a private service-only RPC. */
export function interestIntakeHandler({
  enabled,
  backend,
  notify,
  defer,
}: {
  enabled: boolean;
  backend: InterestBackend;
  notify?: (id: string) => Promise<void>;
  defer?: (work: Promise<unknown>) => void;
}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") || "";
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    };
    const json = (status: number, value: unknown) =>
      new Response(JSON.stringify(value), { status, headers });
    if (!origins.has(origin)) return json(403, { code: "origin_denied" });
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
        },
      });
    if (request.method !== "POST") return json(405, { code: "post_required" });
    if (!enabled) return json(503, { code: "intake_unavailable" });
    if (
      (request.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return json(400, { code: "invalid_request" });
    let input: InterestSubmission | null;
    try {
      input = parseInterestSubmission(await boundedBody(request));
    } catch {
      input = null;
    }
    if (!input) return json(400, { code: "invalid_request" });
    try {
      const result = await backend.accept(input);
      if (result.status === "accepted") {
        if (notify && result.dispatchId) {
          const work = notify(result.dispatchId).catch(() => undefined);
          if (defer) defer(work);
          else await work;
        }
        return json(202, { status: "accepted", reference: input.id });
      }
      if (result.status === "rate_limited")
        return json(429, { code: "temporarily_limited" });
      if (result.status === "conflict")
        return json(409, { code: "request_reference_changed" });
      return json(503, { code: "intake_unavailable" });
    } catch {
      // Never expose/log email, request body, database errors or credentials.
      return json(503, { code: "receipt_unconfirmed" });
    }
  };
}
