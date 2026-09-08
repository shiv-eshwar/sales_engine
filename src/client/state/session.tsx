import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Call } from "@twilio/voice-sdk";
import type { BootstrapResponse, PublicProposal } from "../../shared/contracts";
import {
  approveProposal,
  fetchBootstrap,
  refreshLeads,
  selectCampaign,
  selectLead,
  skipLead,
  type LeadQueueResponse
} from "./api";
import {
  fetchCallSession,
  type CallSessionView,
  type DeviceStatus
} from "./calls";
import {
  acceptTwilioIncomingCall,
  onTwilioIncoming,
  rejectTwilioIncomingCall,
  setPendingIncomingCall,
  startTwilioDevice,
  stopTwilioDevice
} from "../twilio/device";

export type IncomingCall = { call: Call; sessionId: string; from: string };

type SessionContextValue = {
  data: BootstrapResponse;
  pending: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  refresh: () => Promise<void>;
  runQueue: (action: () => Promise<LeadQueueResponse>) => Promise<void>;
  handleSelectCampaign: (campaignId: string) => Promise<void>;
  handleSkipLead: (leadId: string) => Promise<void>;
  deviceStatus: DeviceStatus;
  deviceDetail: string;
  incoming: IncomingCall | null;
  answerIncoming: () => Promise<CallSessionView | null>;
  declineIncoming: () => void;
  clearIncoming: () => void;
  setIncoming: (next: IncomingCall | null) => void;
  review: PublicProposal | null;
  setReview: (next: PublicProposal | null) => void;
  afterWrite: (result: { proposal: PublicProposal; lead: BootstrapResponse["lead"]; leads?: BootstrapResponse["leads"]; sheet: BootstrapResponse["sheet"] }) => Promise<void>;
  approveReview: (id: string, fields?: Parameters<typeof approveProposal>[1]) => Promise<void>;
  campaignBusy: boolean;
  setCampaignBusy: (busy: boolean) => void;
  editor: "new" | "edit" | null;
  setEditor: (mode: "new" | "edit" | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

function mergeQueue(data: BootstrapResponse, result: LeadQueueResponse): BootstrapResponse {
  return {
    ...data,
    lead: result.lead,
    leads: result.leads,
    sheet: result.sheet
  };
}

export function SessionProvider({ initial, children }: { initial: BootstrapResponse; children: ReactNode }) {
  const [data, setData] = useState<BootstrapResponse>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [deviceDetail, setDeviceDetail] = useState(initial.twilio.message);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [review, setReview] = useState<PublicProposal | null>(initial.pendingProposal);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [editor, setEditor] = useState<"new" | "edit" | null>(initial.campaigns.length ? null : "new");

  const twilioConfigured = data.twilio.status === "ok";

  const refresh = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const bootstrap = await fetchBootstrap();
      setData(bootstrap);
      setReview((current) => current ?? bootstrap.pendingProposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, []);

  const runQueue = useCallback(async (action: () => Promise<LeadQueueResponse>) => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      setData((current) => mergeQueue(current, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, []);

  const handleSelectCampaign = useCallback(async (campaignId: string) => {
    setPending(true);
    setError(null);
    try {
      const result = await selectCampaign(campaignId);
      setData((current) => ({
        ...current,
        selectedCampaignId: result.selectedCampaignId,
        lead: result.lead,
        leads: result.leads,
        sheet: result.sheet
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, []);

  const handleSkipLead = useCallback(async (leadId: string) => {
    const campaignId = data.selectedCampaignId;
    await runQueue(() => skipLead(leadId, campaignId));
  }, [data.selectedCampaignId, runQueue]);

  // Lead selection for deep links is handled in LeadDetailPage via selectLead + runQueue.

  useEffect(() => {
    if (!twilioConfigured) {
      setDeviceStatus("offline");
      setDeviceDetail(data.twilio.message);
      return undefined;
    }
    let cancelled = false;
    void startTwilioDevice((status, detail) => {
      if (!cancelled) {
        setDeviceStatus(status);
        setDeviceDetail(detail);
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        setDeviceStatus("error");
        setDeviceDetail(err instanceof Error ? err.message : "Twilio device failed");
      }
    });
    return () => {
      cancelled = true;
      void stopTwilioDevice();
    };
  }, [twilioConfigured, data.twilio.message]);

  useEffect(() => {
    if (deviceStatus !== "registered") return undefined;
    return onTwilioIncoming((call) => {
      const sessionId = call.customParameters.get("sessionId") ?? "";
      const from = call.customParameters.get("From") ?? call.parameters["From"] ?? "Unknown caller";
      if (!sessionId) {
        call.reject();
        return;
      }
      setPendingIncomingCall(call);
      const clear = () => setIncoming((current) => (current?.call === call ? null : current));
      call.on("cancel", clear);
      call.on("disconnect", clear);
      setIncoming({ call, sessionId, from });
    });
  }, [deviceStatus]);

  const answerIncoming = useCallback(async () => {
    if (!incoming) return null;
    const { call: ringing, sessionId } = incoming;
    setIncoming(null);
    setPending(true);
    setError(null);
    try {
      acceptTwilioIncomingCall(ringing);
      return await fetchCallSession(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer call");
      return null;
    } finally {
      setPending(false);
    }
  }, [incoming]);

  const declineIncoming = useCallback(() => {
    if (!incoming) return;
    rejectTwilioIncomingCall(incoming.call);
    setIncoming(null);
  }, [incoming]);

  const clearIncoming = useCallback(() => setIncoming(null), []);

  const afterWrite = useCallback(async (result: {
    proposal: PublicProposal;
    lead: BootstrapResponse["lead"];
    leads?: BootstrapResponse["leads"];
    sheet: BootstrapResponse["sheet"];
  }) => {
    if (result.proposal.status === "applied" || result.proposal.status === "discarded") {
      setReview(null);
      const bootstrap = await fetchBootstrap();
      setData(bootstrap);
      return;
    }
    setReview(result.proposal);
    setData((current) => ({
      ...current,
      lead: result.lead,
      leads: result.leads ?? current.leads,
      sheet: result.sheet,
      pendingProposal: result.proposal.status === "pending_retry" ? result.proposal : null
    }));
  }, []);

  const approveReview = useCallback(async (id: string, fields?: Parameters<typeof approveProposal>[1]) => {
    setPending(true);
    setError(null);
    try {
      await afterWrite(await approveProposal(id, fields));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setPending(false);
    }
  }, [afterWrite]);

  const value = useMemo<SessionContextValue>(() => ({
    data,
    pending,
    error,
    setError,
    refresh,
    runQueue,
    handleSelectCampaign,
    handleSkipLead,
    deviceStatus,
    deviceDetail,
    incoming,
    answerIncoming,
    declineIncoming,
    clearIncoming,
    setIncoming,
    review,
    setReview,
    afterWrite,
    approveReview,
    campaignBusy,
    setCampaignBusy,
    editor,
    setEditor
  }), [
    data, pending, error, refresh, runQueue, handleSelectCampaign, handleSkipLead,
    deviceStatus, deviceDetail, incoming, answerIncoming, declineIncoming, clearIncoming,
    review, afterWrite, approveReview, campaignBusy, editor
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export { refreshLeads, skipProposal, retryProposalProcessing, discardProposal } from "./api";
export { selectLead };
