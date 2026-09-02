import type { BootstrapResponse, DailySummary, PublicLead, PublicProposal, PublicWriteFields } from "../../shared/contracts";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function login(password: string): Promise<void> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}

export async function fetchSession(): Promise<boolean> {
  const response = await fetch("/api/session", { credentials: "include" });
  return response.ok;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BootstrapResponse;
}

export async function skipLead(leadId: string, campaignId: string | null): Promise<{ lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch("/api/leads/skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ leadId, campaignId: campaignId ?? undefined })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as { lead: PublicLead | null; sheet: BootstrapResponse["sheet"] };
}

export async function refreshLeads(campaignId: string | null): Promise<{ lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
  const response = await fetch("/api/leads/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ campaignId: campaignId ?? undefined })
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as { lead: PublicLead | null; sheet: BootstrapResponse["sheet"] };
}

export async function selectCampaign(campaignId: string): Promise<{ selectedCampaignId: string; lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
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

export async function approveProposal(
  id: string,
  fields?: PublicWriteFields
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
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
    sheet: BootstrapResponse["sheet"];
  };
}

export async function retryProposalWrite(
  id: string
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
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
    sheet: BootstrapResponse["sheet"];
  };
}

export async function skipProposal(
  id: string
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
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
