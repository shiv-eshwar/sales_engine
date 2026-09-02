import type { CallLiveEvent, PublicLead, PublicUtterance, TranscriptionHealth } from "../../shared/contracts";

export type CoachSnapshot = Extract<CallLiveEvent, { type: "coach" }>["snapshot"];

export type CallSessionView = {
  id: string;
  leadId: string;
  campaignId: string;
  status: string;
  transportOutcome: string | null;
  phoneE164: string;
  contactName: string;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  recordingSid: string | null;
  transcriptComplete: boolean | null;
  transcriptionHealth: TranscriptionHealth;
  utterances: PublicUtterance[];
  coach: CoachSnapshot | null;
};

export type DeviceStatus = "offline" | "registering" | "registered" | "error";

export type { PublicUtterance, TranscriptionHealth };

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function fetchVoiceToken(): Promise<string> {
  const response = await fetch("/api/twilio/token", {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const body = (await response.json()) as { token: string };
  return body.token;
}

export async function createCallSession(leadId: string, campaignId: string): Promise<CallSessionView> {
  const response = await fetch("/api/calls/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ leadId, campaignId })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as CallSessionView;
}

export async function fetchCallSession(id: string): Promise<CallSessionView> {
  const response = await fetch(`/api/calls/${id}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as CallSessionView;
}

export async function cancelCallSession(id: string): Promise<CallSessionView> {
  const response = await fetch(`/api/calls/${id}/cancel`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as CallSessionView;
}

export function callEventsUrl(sessionId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/calls/${sessionId}/events`;
}

export function callDisabledReason(input: {
  twilioConfigured: boolean;
  deviceStatus: DeviceStatus;
  lead: PublicLead | null;
  callActive: boolean;
}): string | null {
  if (input.callActive) {
    return "A call is already in progress";
  }
  if (!input.twilioConfigured) {
    return "Twilio Voice is not configured";
  }
  if (input.deviceStatus !== "registered") {
    return `Twilio device is ${input.deviceStatus}`;
  }
  if (!input.lead) {
    return "No eligible lead";
  }
  if (!input.lead.dialable) {
    return "Lead phone is not dialable";
  }
  return null;
}
