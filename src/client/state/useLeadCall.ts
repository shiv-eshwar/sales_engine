import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProspectPreparation } from "../../shared/campaigns";
import type { PublicLead } from "../../shared/contracts";
import { finalizeCall, prepareLead, refreshLeads } from "./api";
import {
  callDisabledReason,
  cancelCallSession,
  createCallSession,
  type CallSessionView
} from "./calls";
import { connectTwilioCall, hangUpTwilioCall } from "../twilio/device";
import { useSession } from "./session";

export function useLeadCall(lead: PublicLead | null) {
  const navigate = useNavigate();
  const { data, pending, deviceStatus, runQueue, handleSkipLead, setReview, setLiveCall } = useSession();
  const [call, setCall] = useState<CallSessionView | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [prepState, setPrepState] = useState<{
    key: string;
    result: ProspectPreparation | null;
    error: string | null;
    loading: boolean;
  } | null>(null);
  const [prepRefresh, setPrepRefresh] = useState<{ key: string; attempt: number } | null>(null);

  const campaign = useMemo(
    () => data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? data.campaigns[0],
    [data.campaigns, data.selectedCampaignId]
  );
  const twilioConfigured = data.twilio.status === "ok";
  const callActive = Boolean(call);
  const sheetBlocking = data.sheet.status === "error" || data.sheet.status === "unconfigured";

  const prepKey =
    campaign?.brief && lead
      ? JSON.stringify([
          campaign.id,
          campaign.version,
          lead.leadId,
          lead.company,
          lead.fullName,
          lead.role,
          lead.enrichment
        ])
      : "";
  const preparation = prepState?.key === prepKey ? prepState.result : null;
  const prepError = prepState?.key === prepKey ? prepState.error : null;
  const preparing = Boolean(prepKey && (prepState?.key !== prepKey || prepState.loading));
  const refreshAttempt = prepRefresh?.key === prepKey ? prepRefresh.attempt : 0;

  const disabledReason = !campaign
    ? "Create a campaign first"
    : campaign.brief && (!preparation || preparing)
      ? preparing
        ? "Preparing research and call brief…"
        : "Generate a call brief before calling"
      : callDisabledReason({
          twilioConfigured,
          deviceStatus,
          lead: lead ?? null,
          callActive,
          sheetStatus: data.sheet.status
        });

  useEffect(() => {
    setLiveCall(call);
    return () => setLiveCall(null);
  }, [call, setLiveCall]);

  useEffect(() => {
    if (!prepKey || !campaign || !lead || callActive) return undefined;
    const controller = new AbortController();
    setPrepState({ key: prepKey, result: null, error: null, loading: true });
    void prepareLead(campaign.id, lead.leadId, refreshAttempt > 0, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPrepState({ key: prepKey, result, error: null, loading: false });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPrepState({
            key: prepKey,
            result: null,
            error: err instanceof Error ? err.message : "Preparation failed",
            loading: false
          });
        }
      });
    return () => controller.abort();
  }, [prepKey, refreshAttempt, callActive, campaign, lead]);

  async function onCall() {
    if (!lead || !data.selectedCampaignId || disabledReason) return;
    setStarting(true);
    setCallError(null);
    try {
      const session = await createCallSession(lead.leadId, data.selectedCampaignId, preparation?.id);
      setCall(session);
      try {
        await connectTwilioCall(session.id);
      } catch (connectError) {
        await cancelCallSession(session.id);
        try {
          setReview(await finalizeCall(session.id));
          setCall(null);
          navigate(`/calls/${session.id}/review`);
          return;
        } catch {
          setCall(null);
        }
        throw connectError;
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Could not start call");
    } finally {
      setStarting(false);
    }
  }

  async function openReview(sessionId: string) {
    hangUpTwilioCall();
    try {
      const proposal = await finalizeCall(sessionId);
      setReview(proposal);
      setCall(null);
      navigate(`/calls/${sessionId}/review`);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Could not prepare review");
      setCall(null);
    }
  }

  async function onSkip() {
    if (!lead) return;
    const result = await handleSkipLead(lead.leadId);
    if (result?.lead && result.lead.leadId !== lead.leadId) {
      navigate(`/leads/${encodeURIComponent(result.lead.leadId)}`);
    } else {
      navigate("/leads");
    }
  }

  function onRefresh() {
    void runQueue(() => refreshLeads(data.selectedCampaignId));
  }

  const opening =
    preparation?.brief.opening ?? campaign?.strategy?.opening ?? campaign?.openingContext ?? null;
  const firstQuestion =
    preparation?.brief.questions.find((question) => question.required)?.prompt ??
    campaign?.requiredQuestions.find((question) => question.required)?.prompt ??
    campaign?.requiredQuestions[0]?.prompt ??
    null;

  return {
    campaign,
    call,
    setCall,
    callError,
    starting,
    pending,
    disabledReason,
    sheetBlocking,
    preparation,
    preparing,
    prepError,
    opening,
    firstQuestion,
    onCall,
    onSkip,
    onRefresh,
    openReview,
    regeneratePrep: () => setPrepRefresh({ key: prepKey, attempt: refreshAttempt + 1 })
  };
}
