export type SheetStatus = "ok" | "unconfigured" | "error";

export type SheetDiagnostic = {
  code: "blank_lead_id" | "duplicate_lead_id" | "invalid_phone" | "missing_header" | "duplicate_header";
  message: string;
  leadId?: string;
  rowNumber?: number;
};

export type PublicLead = {
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
  issues: string[];
};

export type PublicCampaign = {
  id: string;
  name: string;
  type: "sales" | "research" | "networking";
  version: number;
  objective: string;
  requiredQuestions: Array<{ id: string; prompt: string; required: boolean }>;
};

export type ProviderStatus = {
  status: "ok" | "not_configured" | "error";
  message: string;
};

export type BootstrapResponse = {
  campaigns: PublicCampaign[];
  selectedCampaignId: string | null;
  sheet: {
    status: SheetStatus;
    message: string;
    diagnostics: SheetDiagnostic[];
  };
  twilio: ProviderStatus;
  lead: PublicLead | null;
  recordingNotice: string;
};

export type SessionResponse = {
  authenticated: boolean;
};

export type HealthLiveResponse = {
  status: "ok";
};

export type HealthReadyResponse = {
  status: "ok" | "not_ready";
  checks: Record<
    string,
    {
      ok: boolean;
      message: string;
    }
  >;
};

export type TranscriptionHealth = "ok" | "interrupted" | "unavailable";

export type PublicUtterance = {
  id: string;
  sessionId: string;
  speaker: "caller" | "contact";
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  confidence: number | null;
  isFinal: true;
  sequence: number;
};

export type CallLiveEvent =
  | { type: "interim"; speaker: "caller" | "contact"; text: string }
  | { type: "final"; utterance: PublicUtterance }
  | { type: "health"; status: TranscriptionHealth };
