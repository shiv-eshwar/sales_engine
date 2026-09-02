export type LeadRecord = {
  leadId: string;
  fullName: string;
  phone: string;
  phoneE164: string | null;
  dialable: boolean;
  company: string;
  role: string;
  enrichment: string;
  campaignId: string;
  crmStatus: string;
  callStatus: string;
  rowNumber: number;
  cells: Record<string, string>;
  issues: string[];
};

export type QueueResult = {
  leads: LeadRecord[];
  diagnostics: Array<{
    code: "blank_lead_id" | "duplicate_lead_id" | "invalid_phone";
    message: string;
    leadId?: string;
    rowNumber?: number;
  }>;
};

export type WriteFields = Partial<{
  call_status: string;
  call_attempts: string;
  last_called_at: string;
  call_outcome: string;
  qualification: string;
  qualification_reason: string;
  objections: string;
  next_step: string;
  follow_up_at: string;
  call_summary: string;
  twilio_call_sid: string;
  recording_sid: string;
}>;

export type ApplyWriteInput = {
  leadId: string;
  snapshotPhone: string;
  fields: WriteFields;
};

export type ApplyWriteResult =
  | { ok: true; verified: Record<string, string> }
  | {
      ok: false;
      code: "identity_conflict" | "ownership" | "verify_failed" | "not_found" | "preflight";
      message: string;
      pendingRetryId?: string;
    };
