import { z } from "zod";
import { callStageSchema, cueTypeSchema, criterionStateSchema } from "../../shared/schemas.js";

export const liveCoachOutputSchema = z.object({
  basedOnSequence: z.number().int(),
  stage: callStageSchema,
  shouldShow: z.boolean(),
  cueType: cueTypeSchema,
  cue: z.string().max(160),
  reason: z.string().max(240),
  detectedObjection: z.string().nullable(),
  qualificationUpdates: z.array(
    z.object({
      criterion: z.string(),
      state: criterionStateSchema,
      evidence: z.string().nullable(),
      confidence: z.number().min(0).max(1)
    })
  ),
  recommendedOutcome: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});

export type LiveCoachOutput = z.infer<typeof liveCoachOutputSchema>;
