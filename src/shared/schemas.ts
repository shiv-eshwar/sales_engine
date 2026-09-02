import { z } from "zod";

export const campaignTypeSchema = z.enum(["sales", "research", "networking"]);

export const criterionSchema = z.object({
  prompt: z.string().min(1),
  required_for_qualified: z.boolean()
});

export const campaignConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: campaignTypeSchema,
  version: z.number().int().positive(),
  objective: z.string().min(1),
  opening_context: z.string().min(1),
  approved_claims: z.array(
    z.object({
      id: z.string().min(1),
      text: z.string().min(1),
      evidence: z.string().min(1)
    })
  ),
  required_questions: z.array(
    z.object({
      id: z.string().min(1),
      prompt: z.string().min(1),
      required: z.boolean()
    })
  ),
  forbidden_behaviors: z.array(z.string().min(1)),
  success_outcomes: z.array(z.string().min(1)).min(1),
  terminal_outcomes: z.array(z.string().min(1)).min(1),
  qualification: z.object({
    criteria: z.record(z.string(), criterionSchema),
    disqualifiers: z.array(z.string().min(1))
  })
});

export const sheetsConfigSchema = z
  .object({
    spreadsheet_id: z.string().min(1),
    sheet_name: z.string().min(1),
    header_row: z.number().int().positive(),
    identity_column: z.string().min(1),
    read_columns: z.object({
      lead_id: z.string().min(1),
      full_name: z.string().min(1),
      phone: z.string().min(1),
      company: z.string().min(1),
      role: z.string().min(1),
      enrichment: z.string().min(1),
      campaign_id: z.string().min(1),
      crm_status: z.string().min(1)
    }),
    write_columns: z.object({
      call_status: z.string().min(1),
      call_attempts: z.string().min(1),
      last_called_at: z.string().min(1),
      call_outcome: z.string().min(1),
      qualification: z.string().min(1),
      qualification_reason: z.string().min(1),
      objections: z.string().min(1),
      next_step: z.string().min(1),
      follow_up_at: z.string().min(1),
      call_summary: z.string().min(1),
      twilio_call_sid: z.string().min(1),
      recording_sid: z.string().min(1)
    }),
    eligible_when: z.record(z.string(), z.array(z.string())),
    ownership: z.object({
      gumloop_owned: z.array(z.string().min(1)).min(1),
      application_owned: z.array(z.string().min(1)).min(1)
    })
  })
  .superRefine((cfg, ctx) => {
    const gumloop = new Set(cfg.ownership.gumloop_owned);
    const application = new Set(cfg.ownership.application_owned);

    for (const header of gumloop) {
      if (application.has(header)) {
        ctx.addIssue({
          code: "custom",
          message: `Column "${header}" cannot be both Gumloop-owned and application-owned`
        });
      }
    }

    if (cfg.identity_column !== cfg.read_columns.lead_id) {
      ctx.addIssue({
        code: "custom",
        message: `identity_column "${cfg.identity_column}" must match read_columns.lead_id "${cfg.read_columns.lead_id}"`
      });
    }

    for (const header of Object.values(cfg.write_columns)) {
      if (!application.has(header)) {
        ctx.addIssue({
          code: "custom",
          message: `Write column "${header}" is not listed in ownership.application_owned`
        });
      }
      if (gumloop.has(header)) {
        ctx.addIssue({
          code: "custom",
          message: `Write column "${header}" is Gumloop-owned and cannot be writable`
        });
      }
    }
  });

export const playbookConfigSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  stages: z.array(z.string().min(1)).min(1),
  talk_ratio: z.object({
    caller_target: z.number(),
    warn_caller_above: z.number(),
    warn_after_connected_seconds: z.number().int().nonnegative()
  }),
  principles: z.array(z.string().min(1)),
  objection_flow: z.array(z.string().min(1)),
  objections: z.array(z.string().min(1)),
  cue_max_characters: z.number().int().positive()
});

export type CampaignConfig = z.infer<typeof campaignConfigSchema>;
export type SheetsConfig = z.infer<typeof sheetsConfigSchema>;
export type PlaybookConfig = z.infer<typeof playbookConfigSchema>;

export const loginRequestSchema = z.object({
  password: z.string().min(1)
});

export const skipLeadRequestSchema = z.object({
  leadId: z.string().min(1),
  campaignId: z.string().min(1).optional()
});

export const refreshLeadRequestSchema = z.object({
  campaignId: z.string().min(1).optional()
});

export const writeFieldKeySchema = z.enum([
  "call_status",
  "call_attempts",
  "last_called_at",
  "call_outcome",
  "qualification",
  "qualification_reason",
  "objections",
  "next_step",
  "follow_up_at",
  "call_summary",
  "twilio_call_sid",
  "recording_sid"
]);
