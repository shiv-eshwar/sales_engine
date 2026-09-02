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
  pendingProposal: PublicProposal | null;
  summary: DailySummary;
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

export type WriteFieldKey =
  | "call_status"
  | "call_attempts"
  | "last_called_at"
  | "call_outcome"
  | "qualification"
  | "qualification_reason"
  | "objections"
  | "next_step"
  | "follow_up_at"
  | "call_summary"
  | "twilio_call_sid"
  | "recording_sid";

export type PublicWriteFields = Partial<Record<WriteFieldKey, string>>;

export type ProposalStatus = "processing" | "pending_review" | "pending_retry" | "applied" | "discarded";

export type PublicProposalDiff = {
  key: WriteFieldKey;
  header: string;
  current: string;
  proposed: string;
  changed: boolean;
};

export type PublicProposal = {
  id: string;
  sessionId: string;
  status: ProposalStatus;
  kind: "connected" | "non_connect";
  leadId: string;
  campaignId: string;
  contactName: string;
  transportOutcome: string | null;
  semanticOutcome: string;
  qualification: string;
  qualificationReason: string;
  criteria: Array<{
    id: string;
    prompt: string;
    state: "yes" | "no" | "unknown";
    evidence: string | null;
    confidence: number;
  }>;
  painOrResearchFindings: string[];
  objections: string[];
  nextStep: string;
  followUpAt: string | null;
  summary: string;
  callerCommitments: string[];
  contactCommitments: string[];
  transcriptComplete: boolean | null;
  confidence: number;
  warnings: string[];
  proposedFields: PublicWriteFields;
  diff: PublicProposalDiff[];
  lastError: string | null;
  utterances: PublicUtterance[];
  coachingReplay: Array<{
    stage: string;
    cueType: string;
    cue: string | null;
    reason: string | null;
  }>;
};

export type DailySummary = {
  date: string;
  attempts: number;
  connects: number;
  qualified: number;
  disqualified: number;
  unknown: number;
  meetings: number;
  followUps: number;
  references: number;
  callbacks: number;
  noAnswer: number;
  busy: number;
  failed: number;
  averageTalkRatio: number | null;
  coachingObservation: string | null;
};

export type CallLiveEvent =
  | { type: "interim"; speaker: "caller" | "contact"; text: string }
  | { type: "final"; utterance: PublicUtterance }
  | { type: "health"; status: TranscriptionHealth }
  | {
      type: "coach";
      snapshot: {
        stage: string;
        cue: {
          text: string;
          cueType: string;
          reason: string;
          shouldShow: boolean;
          basedOnSequence: number;
        } | null;
        qualification: Array<{
          id: string;
          prompt: string;
          state: "yes" | "no" | "unknown";
          evidence: string | null;
        }>;
        recommendedOutcome: string | null;
        talkRatio: {
          callerShare: number;
          contactShare: number;
          callerMs: number;
          contactMs: number;
          connectedSeconds: number;
          warn: boolean;
        };
        priorObjections: string[];
      };
    };
