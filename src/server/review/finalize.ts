import type Database from "better-sqlite3";
import type { CampaignConfig, PlaybookConfig, SheetsConfig } from "../../shared/schemas.js";
import type { PublicProposal } from "../../shared/contracts.js";
import { isTerminalStatus } from "../calls/state.js";
import { getSession, type LeadSnapshot } from "../calls/ledger.js";
import type { CoachEngine } from "../coach/engine.js";
import { emptyCriteria } from "../coach/qualification.js";
import { computeTalkRatio } from "../coach/talkRatio.js";
import { detectsDoNotContact } from "../coach/dnc.js";
import type { LlmClient } from "../llm/types.js";
import type { SheetAdapter } from "../sheets/adapter.js";
import { GAP_TEXT, listUtterances } from "../transcript/utterances.js";
import type { MediaHub } from "../twilio/mediaHub.js";
import { RETRY_CALL_STATUS, connectedFields, currentWriteFields, transportFields } from "./fields.js";
import { defaultConnectedOutcome, buildExtractionPrompt } from "./prompt.js";
import { toPublicProposal } from "./public.js";
import { emptyPostCallOutcome, type StoredProposalBody } from "./schema.js";
import {
  getProposal,
  getProposalBySession,
  insertProposal,
  updateProposalBody,
  type ProposalRow
} from "./store.js";
import { validatePostCallOutcome } from "./validate.js";

export class ReviewFinalizer {
  constructor(
    private readonly deps: {
      db: Database.Database;
      campaigns: CampaignConfig[];
      playbook: PlaybookConfig | null;
      sheetsConfig: SheetsConfig | null;
      adapter: SheetAdapter | null;
      llm: LlmClient | null;
      coachEngine: CoachEngine;
      mediaHub: MediaHub;
    }
  ) {}

  async finalize(sessionId: string): Promise<PublicProposal> {
    const existing = getProposalBySession(this.deps.db, sessionId);
    if (existing && existing.status !== "processing") {
      return this.present(existing);
    }

    this.deps.coachEngine.stop(sessionId);
    await this.deps.mediaHub.flushSession(sessionId);

    const session = getSession(this.deps.db, sessionId);
    if (!session) {
      throw new Error("Call session not found");
    }
    if (!isTerminalStatus(session.status)) {
      throw new Error("Call is still active");
    }

    const campaign = this.deps.campaigns.find((item) => item.id === session.campaign_id);
    if (!campaign) {
      throw new Error("Unknown campaign");
    }
    const snapshot = JSON.parse(session.lead_snapshot_json) as LeadSnapshot;
    const transport = session.transport_outcome ?? session.status;
    const nonConnect =
      !session.connected_at ||
      transport === "busy" ||
      transport === "failed" ||
      transport === "no-answer" ||
      transport === "canceled";
    const transcriptComplete = session.transcript_complete === 1;
    const utterances = listUtterances(this.deps.db, sessionId);
    if (!this.deps.sheetsConfig) {
      throw new Error("Sheet is not configured");
    }
    const sheetValues = this.deps.adapter
      ? await this.deps.adapter.readApplicationSnapshot(snapshot.leadId)
      : null;
    const current = currentWriteFields(this.deps.sheetsConfig, sheetValues?.cells ?? {});

    let body: StoredProposalBody;
    if (!nonConnect) {
      body = await this.connectedBody({
        sessionId,
        campaign,
        snapshot,
        current,
        utterances,
        transcriptComplete,
        transportOutcome: session.transport_outcome,
        twilioSid: session.twilio_parent_sid ?? session.twilio_child_sid,
        recordingSid: session.recording_sid
      });
    } else {
      const outcome = emptyPostCallOutcome({
        campaign,
        transcriptComplete,
        semanticOutcome: "unknown",
        qualification: "unknown",
        reason: `Non-connect: ${transport}. Semantic fields were left unchanged.`
      });
      body = {
        kind: "non_connect",
        llmUsed: false,
        leadId: snapshot.leadId,
        campaignId: campaign.id,
        snapshotPhone: snapshot.phone,
        contactName: snapshot.fullName,
        transportOutcome: transport,
        outcome,
        fields: transportFields({
          current,
          transportOutcome: transport,
          callStatus: RETRY_CALL_STATUS,
          nowIso: new Date().toISOString(),
          twilioSid: session.twilio_parent_sid ?? session.twilio_child_sid,
          recordingSid: session.recording_sid
        }),
        currentFields: current,
        warnings: []
      };
    }

    const evidence = {
      utteranceIds: utterances.filter((row) => row.text !== GAP_TEXT).map((row) => row.id)
    };

    if (existing) {
      const updated = updateProposalBody(this.deps.db, existing.id, body, evidence, "pending_review");
      return this.present(updated ?? existing);
    }
    try {
      const created = insertProposal(this.deps.db, {
        sessionId,
        body,
        evidence,
        status: "pending_review"
      });
      return this.present(created);
    } catch {
      const raced = getProposalBySession(this.deps.db, sessionId);
      if (raced) {
        return this.present(raced);
      }
      throw new Error("Failed to store post-call proposal");
    }
  }

  present(row: ProposalRow): PublicProposal {
    if (!this.deps.sheetsConfig) {
      throw new Error("Sheet is not configured");
    }
    return toPublicProposal(this.deps.db, row, {
      sheets: this.deps.sheetsConfig,
      campaigns: this.deps.campaigns
    });
  }

  async refreshCurrent(row: ProposalRow): Promise<PublicProposal> {
    const body = JSON.parse(row.proposed_json) as StoredProposalBody;
    const snapshot = this.deps.adapter
      ? await this.deps.adapter.readApplicationSnapshot(body.leadId)
      : null;
    const current = snapshot && this.deps.sheetsConfig
      ? currentWriteFields(this.deps.sheetsConfig, snapshot.cells)
      : body.currentFields;
    if (!this.deps.sheetsConfig) {
      throw new Error("Sheet is not configured");
    }
    return toPublicProposal(this.deps.db, row, {
      sheets: this.deps.sheetsConfig,
      campaigns: this.deps.campaigns,
      currentFields: current
    });
  }

  private async connectedBody(input: {
    sessionId: string;
    campaign: CampaignConfig;
    snapshot: LeadSnapshot;
    current: ReturnType<typeof currentWriteFields>;
    utterances: ReturnType<typeof listUtterances>;
    transcriptComplete: boolean;
    transportOutcome: string | null;
    twilioSid: string | null;
    recordingSid: string | null;
  }): Promise<StoredProposalBody> {
    const live = this.deps.coachEngine.getSnapshot(input.sessionId);
    const doNotContact =
      live?.recommendedOutcome === "do_not_contact" ||
      input.utterances.some((row) => detectsDoNotContact(row.text));
    const warnings: string[] = [];
    if (!input.transcriptComplete) {
      warnings.push("Transcript is incomplete. Treat extraction as low confidence.");
    }

    let outcome = defaultConnectedOutcome({
      campaign: input.campaign,
      transcriptComplete: input.transcriptComplete,
      doNotContact
    });
    let llmUsed = false;

    if (this.deps.llm && !doNotContact) {
      const criteria = emptyCriteria(input.campaign);
      if (live) {
        for (const item of live.qualification) {
          criteria[item.id] = {
            state: item.state,
            evidence: item.evidence,
            source: item.evidence ? "transcript" : null,
            confidence: 0
          };
        }
      }
      const talk = computeTalkRatio(input.utterances, getSession(this.deps.db, input.sessionId)?.connected_at ?? null, this.deps.playbook);
      const prompt = buildExtractionPrompt({
        campaign: input.campaign,
        playbook: this.deps.playbook,
        snapshot: input.snapshot,
        utterances: input.utterances,
        criteria,
        talk,
        priorObjections: live?.priorObjections ?? [],
        transcriptComplete: input.transcriptComplete
      });
      try {
        const raw = await this.deps.llm.completeJson(prompt);
        llmUsed = true;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        if (parsed) {
          const validated = validatePostCallOutcome(parsed, {
            campaign: input.campaign,
            utterances: input.utterances,
            snapshot: input.snapshot
          });
          if (validated.ok) {
            outcome = validated.output;
            if (outcome.confidence < 0.5) {
              warnings.push("Extraction confidence is low.");
            }
          } else {
            warnings.push("Extraction output was invalid and was discarded.");
          }
        } else {
          warnings.push("Extraction output was not valid JSON.");
        }
      } catch {
        warnings.push("Post-call extraction failed. Review the conservative draft.");
      }
    } else if (!this.deps.llm && !doNotContact) {
      warnings.push("LLM is not configured; connected extraction was skipped.");
    }

    if (doNotContact) {
      outcome = defaultConnectedOutcome({
        campaign: input.campaign,
        transcriptComplete: input.transcriptComplete,
        doNotContact: true
      });
    }

    const fields = connectedFields({
      current: input.current,
      outcome,
      nowIso: new Date().toISOString(),
      twilioSid: input.twilioSid,
      recordingSid: input.recordingSid
    });

    return {
      kind: "connected",
      llmUsed,
      leadId: input.snapshot.leadId,
      campaignId: input.campaign.id,
      snapshotPhone: input.snapshot.phone,
      contactName: input.snapshot.fullName,
      transportOutcome: input.transportOutcome ?? "completed",
      outcome,
      fields,
      currentFields: input.current,
      warnings
    };
  }
}

export function getProposalOrThrow(db: Database.Database, id: string): ProposalRow {
  const row = getProposal(db, id);
  if (!row) {
    throw new Error("Proposal not found");
  }
  return row;
}
