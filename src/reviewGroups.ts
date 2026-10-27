import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceSchema } from "./reviewServices";
import { reviewSchema, VideoReviews } from "./videoReviews";
export const groupSchema = serviceSchema.extend({
  is_grouped: z.literal(true),
  group_submitted_at: z.string().nullable(),
  feedback: z.string(),
  erased: z.boolean(),
  clip_count: z.number().int().min(0).max(3),
  total_seconds: z.coerce.number().max(180),
  clips: z.array(z.lazy(() => reviewSchema)),
});
export type ReviewGroup = z.infer<typeof groupSchema>;
export type ProposedClip = {
  id: string;
  training_id: string;
  media_type: string;
  byte_size: number;
  duration_seconds: number;
};
export class ReviewGroups {
  constructor(readonly client: SupabaseClient) {}
  private async call(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw new Error(
        error.message ||
          "This review could not be confirmed. Refresh and retry the same draft.",
      );
    return groupSchema.parse(data);
  }
  create(id: string, profile: string, clips: ProposedClip[]) {
    return this.call("create_review_group", {
      request_id: id,
      target_profile: profile,
      clips,
    });
  }
  detail(id: string) {
    return this.call("review_group_detail", { request_id: id });
  }
  submit(id: string) {
    return this.call("submit_review_group", { request_id: id });
  }
  start(g: ReviewGroup) {
    return this.call("start_review_group", {
      request_id: g.id,
      expected_version: g.version,
    });
  }
  feedback(g: ReviewGroup, text: string) {
    return this.call("save_review_group_feedback", {
      request_id: g.id,
      feedback_text: text.trim(),
      expected_version: g.version,
    });
  }
  async remove(g: ReviewGroup) {
    if (g.clips.length) {
      const { error } = await this.client.storage
        .from("athlete-review-videos")
        .remove(g.clips.map((c) => c.asset_path));
      if (error)
        throw new Error(
          "Clip deletion was not confirmed. Retry; the review record has not been cleared.",
        );
    }
    const { error } = await this.client.rpc("delete_review_group", {
      request_id: g.id,
    });
    if (error)
      throw new Error(
        "Stored clips were removed, but cleanup was not confirmed. Refresh and retry deletion.",
      );
  }
  videos() {
    return new VideoReviews(this.client);
  }
}
