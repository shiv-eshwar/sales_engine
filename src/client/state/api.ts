import type { BootstrapResponse, DailySummary, HealthReadyResponse, PublicCalendarProposal, PublicCampaign, PublicLead, PublicProposal, PublicWriteFields, SessionResponse, SheetInfo } from "../../shared/contracts";
import type { CampaignBrief, ProspectPreparation } from "../../shared/campaigns";
import { LEADS_PAGE_SIZE, type LeadSortKey } from "../../shared/leadsQueue";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function signup(email: string, password: string): Promise<void> {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/logout", { method: "POST", credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function fetchSession(): Promise<SessionResponse> {
  try {
    const response = await fetch("/api/session", { credentials: "include" });
    if (!response.ok) {
      return { authenticated: false, email: null };
    }
    return (await response.json()) as SessionResponse;
  } catch {
    return { authenticated: false, email: null };
  }
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BootstrapResponse;
}

export async function fetchHealthReady(): Promise<HealthReadyResponse> {
  const response = await fetch("/health/ready", { credentials: "include" });
  try {
    return (await response.json()) as HealthReadyResponse;
  } catch {
    throw new Error(await parseError(response));
  }
}

export type LeadQueueResponse = { lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] };

export type LeadsPageResponse = LeadQueueResponse & {
  nextCursor: string | null;
  total: number;
  queueSize: number;
  undialableCount: number;
};

export type FetchLeadsInput = {
  campaignId?: string | null;
  q?: string;
  dialableOnly?: boolean;
  sort?: LeadSortKey;
  dir?: 1 | -1;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export async function fetchLeads(input: FetchLeadsInput = {}): Promise<LeadsPageResponse> {
  const params = new URLSearchParams();
  if (input.campaignId) params.set("campaignId", input.campaignId);
  if (input.q) params.set("q", input.q);
  if (input.dialableOnly !== undefined) params.set("dialable", input.dialableOnly ? "1" : "0");
  if (input.sort) params.set("sort", input.sort);
  if (input.dir !== undefined) params.set("dir", input.dir === -1 ? "desc" : "asc");
  if (input.cursor) params.set("cursor", input.cursor);
  params.set("limit", String(input.limit ?? LEADS_PAGE_SIZE));
  const query = params.toString();
  const response = await fetch(`/api/leads${query ? `?${query}` : ""}`, {
    credentials: "include",
    signal: input.signal
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LeadsPageResponse;
}

export async function selectLead(leadId: string, campaignId: string | null): Promise<LeadQueueResponse> {
  const response = await fetch("/api/leads/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ leadId, campaignId: campaignId ?? undefined })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LeadQueueResponse;
}

export async function skipLead(leadId: string, campaignId: string | null): Promise<LeadQueueResponse> {
  const response = await fetch("/api/leads/skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ leadId, campaignId: campaignId ?? undefined })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LeadQueueResponse;
}

export async function refreshLeads(campaignId: string | null): Promise<LeadQueueResponse> {
  const response = await fetch("/api/leads/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ campaignId: campaignId ?? undefined })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LeadQueueResponse;
}

export async function selectCampaign(campaignId: string): Promise<{ selectedCampaignId: string; lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch("/api/campaigns/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ campaignId })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as {
    selectedCampaignId: string;
    lead: PublicLead | null;
    leads: PublicLead[];
    sheet: BootstrapResponse["sheet"];
  };
}

export async function finalizeCall(sessionId: string): Promise<PublicProposal> {
  const response = await fetch(`/api/calls/${sessionId}/finalize`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as PublicProposal;
}

export async function fetchProposalBySession(sessionId: string): Promise<PublicProposal> {
  const response = await fetch(`/api/calls/${encodeURIComponent(sessionId)}/proposal`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as PublicProposal;
}

export async function approveProposal(
  id: string,
  fields?: PublicWriteFields
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch(`/api/proposals/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fields })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as {
    proposal: PublicProposal;
    lead: PublicLead | null;
    leads: PublicLead[];
    sheet: BootstrapResponse["sheet"];
  };
}

export async function retryProposalWrite(
  id: string
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch(`/api/proposals/${id}/retry-write`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as {
    proposal: PublicProposal;
    lead: PublicLead | null;
    leads: PublicLead[];
    sheet: BootstrapResponse["sheet"];
  };
}

export async function skipProposal(
  id: string
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch(`/api/proposals/${id}/skip`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as {
    proposal: PublicProposal;
    lead: PublicLead | null;
    leads: PublicLead[];
    sheet: BootstrapResponse["sheet"];
  };
}

export async function retryProposalProcessing(id: string): Promise<PublicProposal> {
  const response = await fetch(`/api/proposals/${id}/retry-processing`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as PublicProposal;
}

export async function discardProposal(id: string): Promise<PublicProposal> {
  const response = await fetch(`/api/proposals/${id}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ confirm: true })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const body = (await response.json()) as { proposal: PublicProposal };
  return body.proposal;
}

export type { DailySummary };

export async function fetchSummary(input: {
  date?: string;
  campaignId?: string | null;
} = {}): Promise<DailySummary> {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.campaignId) params.set("campaignId", input.campaignId);
  const query = params.toString();
  const response = await fetch(`/api/summary${query ? `?${query}` : ""}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as DailySummary;
}

async function campaignRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error(await parseError(response));
  return await response.json() as T;
}

export function saveCampaign(brief: CampaignBrief, requestId: string, previous?: PublicCampaign): Promise<PublicCampaign> {
  return campaignRequest(previous ? `/api/campaigns/${encodeURIComponent(previous.id)}` : "/api/campaigns", {
    method: previous ? "PUT" : "POST",
    body: JSON.stringify(previous ? { brief, expectedVersion: previous.version } : { brief, requestId })
  });
}

export type ReviewInterviewResponse = {
  text: string;
  proposal: PublicProposal;
  wrote: boolean;
  leftReview: boolean;
  lead: PublicLead | null;
  leads: PublicLead[];
  sheet: BootstrapResponse["sheet"] | null;
  calendarProposal?: PublicCalendarProposal | null;
};

export type CalendarProposalPatch = {
  title?: string;
  start?: string;
  end?: string;
  timezone?: string;
  attendees?: string[];
  meet?: boolean;
  notes?: string | null;
};

export async function approveCalendarProposal(id: string, patch: CalendarProposalPatch = {}): Promise<PublicCalendarProposal> {
  const body = await campaignRequest<{ proposal: PublicCalendarProposal }>(`/api/calendar/proposals/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(patch)
  });
  return body.proposal;
}

export async function dismissCalendarProposal(id: string): Promise<PublicCalendarProposal> {
  const body = await campaignRequest<{ proposal: PublicCalendarProposal }>(`/api/calendar/proposals/${encodeURIComponent(id)}/dismiss`, {
    method: "POST"
  });
  return body.proposal;
}

export async function disconnectCalendar(): Promise<BootstrapResponse["calendar"]> {
  return campaignRequest("/api/google/calendar/disconnect", { method: "POST" });
}

export async function fetchCalendarProposals(sessionId: string): Promise<PublicCalendarProposal[]> {
  const body = await campaignRequest<{ proposals: PublicCalendarProposal[] }>(
    `/api/calls/${encodeURIComponent(sessionId)}/calendar/proposals`
  );
  return body.proposals;
}

export function interviewReview(input: {
  sessionId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  bootstrap?: boolean;
  signal?: AbortSignal;
}): Promise<ReviewInterviewResponse> {
  return campaignRequest(`/api/calls/${encodeURIComponent(input.sessionId)}/review/interview`, {
    method: "POST",
    body: JSON.stringify({
      messages: input.messages,
      bootstrap: input.bootstrap
    }),
    signal: input.signal
  });
}

export function interviewCampaign(input: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  requestId: string;
  campaignId?: string;
  signal?: AbortSignal;
}): Promise<{ text: string; campaign: PublicCampaign | null }> {
  return campaignRequest("/api/campaigns/interview", {
    method: "POST",
    body: JSON.stringify({
      messages: input.messages,
      requestId: input.requestId,
      campaignId: input.campaignId
    }),
    signal: input.signal
  });
}

export type SheetConnectResult = {
  spreadsheetId: string;
  url: string | null;
  title?: string;
  sheetName: string;
  created: boolean;
  initializedHeaders?: boolean;
  sheet: SheetInfo;
};

export function createLeadsSheet(input: {
  title?: string;
  shareEmail?: string;
  requestId?: string;
  campaignId?: string;
} = {}): Promise<SheetConnectResult> {
  return campaignRequest("/api/sheets/create", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function linkLeadsSheet(
  spreadsheet: string,
  input: { requestId?: string; campaignId?: string } = {}
): Promise<SheetConnectResult> {
  return campaignRequest("/api/sheets/link", {
    method: "POST",
    body: JSON.stringify({ spreadsheet, ...input })
  });
}

export function prepareLead(campaignId: string, leadId: string, force: boolean, signal?: AbortSignal): Promise<ProspectPreparation> {
  return campaignRequest(`/api/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(leadId)}/prepare`, {
    method: "POST", body: JSON.stringify({ force }), signal
  });
}
