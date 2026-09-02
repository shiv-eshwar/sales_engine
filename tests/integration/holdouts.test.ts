import { describe, expect, it, vi } from "vitest";
import { applyTransportStatus, getSession } from "../../src/server/calls/ledger.js";
import { listCoachingEvents } from "../../src/server/coach/store.js";
import { EXAMPLE_HEADERS } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import { insertUtterance } from "../../src/server/transcript/utterances.js";
import { postCallOutput, coachOutput, FakeLlmClient } from "../helpers/llm.js";
import { postRecording, postStatus, startConnectedCall, yesCriteria } from "../helpers/call.js";

describe("Holdouts H1–H14", () => {
  it("H1 qualified sales lead with existing-solution objection", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        stage: "objection",
        cueType: "clarify",
        cue: "What still hurts with the tool you use today?",
        detectedObjection: "existing_solution"
      })
    );
    llm.enqueueJson(
      postCallOutput({
        semanticOutcome: "permission_to_follow_up",
        qualification: "qualified",
        qualificationReason: "Problem, cost, influence, and timing were all stated.",
        criteria: yesCriteria,
        objections: ["existing_solution"],
        summary: "They have a painful weekly process, decide next steps, and agreed to a follow-up after describing another tool."
      })
    );
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal(
      "we have painful weekly regressions that cost the team two days. I decide what we try next and we want to look this quarter. we already use another tool though"
    );
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    const cue = (live.json() as { coach: { cue: { cueType: string } | null } }).coach.cue;
    expect(cue?.cueType).toBe("clarify");
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    const proposal = await started.app.inject({
      method: "POST",
      url: `/api/calls/${started.sessionId}/finalize`,
      headers: { cookie: started.cookie }
    });
    expect(proposal.statusCode).toBe(200);
    const body = proposal.json() as {
      qualification: string;
      semanticOutcome: string;
      objections: string[];
    };
    expect(body.qualification).toBe("qualified");
    expect(["meeting_booked", "permission_to_follow_up"]).toContain(body.semanticOutcome);
    expect(body.objections.join(" ")).toMatch(/existing/i);
    await started.app.close();
  });

  it("H2 clear disqualification", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        stage: "closed",
        cueType: "disqualify",
        cue: "Acknowledge and close. They do not have this problem.",
        recommendedOutcome: "disqualified",
        qualificationUpdates: [
          {
            criterion: "relevant_problem",
            state: "no",
            evidence: "we do not have that problem",
            confidence: 0.95
          }
        ]
      })
    );
    llm.enqueueJson(
      postCallOutput({
        semanticOutcome: "disqualified",
        qualification: "disqualified",
        qualificationReason: "No relevant problem; current process meets the need.",
        criteria: {
          relevant_problem: { state: "no", evidence: "we do not have that problem", confidence: 0.95 },
          meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        },
        summary: "Contact said they do not have the problem and the current process fully meets the need."
      })
    );
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal(
      "we do not have that problem and our current process fully meets the need"
    );
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    expect((live.json() as { coach: { cue: { cueType: string } | null } }).coach.cue?.cueType).toBe("disqualify");
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    const proposal = (
      await started.app.inject({
        method: "POST",
        url: `/api/calls/${started.sessionId}/finalize`,
        headers: { cookie: started.cookie }
      })
    ).json() as { semanticOutcome: string; qualification: string };
    expect(proposal.qualification).toBe("disqualified");
    expect(proposal.semanticOutcome).not.toBe("meeting_booked");
    await started.app.close();
  });

  it("H3 insufficient qualification evidence", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cueType: "qualify",
        cue: "Who else is involved in choosing a verification approach?",
        qualificationUpdates: []
      })
    );
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal("things are going fine, just catching up today");
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    const body = live.json() as {
      coach: {
        cue: { text: string } | null;
        qualification: Array<{ id: string; state: string }>;
        recommendedOutcome: string | null;
      };
    };
    expect(body.coach.qualification.every((item) => item.state === "unknown")).toBe(true);
    expect(body.coach.recommendedOutcome === "unknown" || body.coach.recommendedOutcome === null).toBe(true);
    expect(body.coach.cue?.text.toLowerCase()).toMatch(/who|influence|decide|involved/);
    await started.app.close();
  });

  it("H4 do-not-contact writes suppression and drops eligibility", async () => {
    const llm = new FakeLlmClient();
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal("please do not contact me ever again");
    await vi.waitFor(async () => {
      const live = await started.app.inject({
        method: "GET",
        url: `/api/calls/${started.sessionId}`,
        headers: { cookie: started.cookie }
      });
      const cue = (live.json() as { coach: { cue: { cueType: string; text: string } | null } }).coach.cue;
      expect(cue?.cueType).toBe("warning");
      expect(cue?.text.toLowerCase()).toMatch(/end respectfully|not to be contacted/);
    });
    expect(llm.calls.length).toBe(0);
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    const finalized = await started.app.inject({
      method: "POST",
      url: `/api/calls/${started.sessionId}/finalize`,
      headers: { cookie: started.cookie }
    });
    const proposal = finalized.json() as { id: string; semanticOutcome: string };
    expect(proposal.semanticOutcome).toBe("do_not_contact");
    const approved = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie: started.cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const queue = await started.ctx.adapter?.loadQueue();
    expect(queue?.leads.some((lead) => lead.leadId === "L-100")).toBe(false);
    await started.app.close();
  });

  it("H5 no-answer does not call the LLM or start transcription", async () => {
    const llm = new FakeLlmClient();
    const started = await startConnectedCall({ llm, connected: false, media: false });
    await postStatus(started.app, {
      sessionId: started.sessionId,
      CallSid: started.parentSid,
      CallStatus: "ringing"
    });
    await postStatus(started.app, {
      sessionId: started.sessionId,
      CallSid: started.parentSid,
      CallStatus: "no-answer"
    });
    expect(llm.calls.length).toBe(0);
    expect(started.fakes).toHaveLength(0);
    await vi.waitFor(async () => {
      const ready = await started.app.inject({
        method: "GET",
        url: `/api/calls/${started.sessionId}/proposal`,
        headers: { cookie: started.cookie }
      });
      expect(ready.statusCode).toBe(200);
    });
    const proposal = (
      await started.app.inject({
        method: "GET",
        url: `/api/calls/${started.sessionId}/proposal`,
        headers: { cookie: started.cookie }
      })
    ).json() as { id: string; kind: string };
    expect(proposal.kind).toBe("non_connect");
    const approved = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie: started.cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const rows = await (started.ctx.adapter?.store as MemorySheetStore).getDataRows();
    const row = rows.find((item) => item.values[0] === "L-100");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Outcome")]).toBe("no-answer");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Attempts")]).toBe("1");
    await started.app.close();
  });

  it("H6 duplicate and reordered provider events yield one terminal call and one proposal", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(postCallOutput({ criteria: yesCriteria, summary: "Short connected conversation." }));
    const started = await startConnectedCall({ llm });
    insertUtterance(started.ctx.db, {
      sessionId: started.sessionId,
      speaker: "contact",
      text: "painful weekly regressions that cost the team two days",
      startMs: 0,
      endMs: 400,
      confidence: 0.9
    });
    const completed = {
      sessionId: started.sessionId,
      CallSid: started.parentSid,
      CallStatus: "completed"
    };
    await postStatus(started.app, completed);
    await postStatus(started.app, completed);
    await postRecording(started.app, {
      CallSid: started.parentSid,
      RecordingSid: "REholdout6",
      RecordingStatus: "completed"
    });
    await postRecording(started.app, {
      CallSid: started.parentSid,
      RecordingSid: "REholdout6",
      RecordingStatus: "completed"
    });
    await postStatus(started.app, {
      sessionId: started.sessionId,
      CallSid: started.parentSid,
      CallStatus: "in-progress"
    });
    expect(getSession(started.ctx.db, started.sessionId)?.status).toBe("completed");
    await vi.waitFor(async () => {
      const ready = await started.app.inject({
        method: "GET",
        url: `/api/calls/${started.sessionId}/proposal`,
        headers: { cookie: started.cookie }
      });
      expect(ready.statusCode).toBe(200);
    });
    const count = started.ctx.db
      .prepare("SELECT COUNT(*) AS n FROM post_call_proposals WHERE session_id = ?")
      .get(started.sessionId) as { n: number };
    expect(count.n).toBe(1);
    await started.app.close();
  });

  it("H7 Gumloop edits during the call are preserved", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: yesCriteria,
        summary: "Contact described painful weekly regressions that cost the team two days."
      })
    );
    const started = await startConnectedCall({ llm });
    const store = started.ctx.adapter?.store as MemorySheetStore;
    await store.batchUpdate([
      {
        rowNumber: 2,
        columnIndex: EXAMPLE_HEADERS.indexOf("Enrichment"),
        header: "Enrichment",
        value: "Gumloop refreshed enrichment mid-call"
      }
    ]);
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    insertUtterance(started.ctx.db, {
      sessionId: started.sessionId,
      speaker: "contact",
      text: "painful weekly regressions that cost the team two days. I decide what we try next",
      startMs: 0,
      endMs: 500,
      confidence: 0.9
    });
    const finalized = await started.app.inject({
      method: "POST",
      url: `/api/calls/${started.sessionId}/finalize`,
      headers: { cookie: started.cookie }
    });
    const proposal = finalized.json() as { id: string };
    const approved = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie: started.cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const rows = await store.getDataRows();
    const row = rows.find((item) => item.values[0] === "L-100");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Enrichment")]).toBe("Gumloop refreshed enrichment mid-call");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Summary")]).toBeTruthy();
    await started.app.close();
  });

  it("H8 identity conflict blocks the write", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(postCallOutput({ criteria: yesCriteria, summary: "Connected conversation." }));
    const started = await startConnectedCall({ llm });
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    insertUtterance(started.ctx.db, {
      sessionId: started.sessionId,
      speaker: "contact",
      text: "painful weekly regressions that cost the team two days",
      startMs: 0,
      endMs: 400,
      confidence: 0.9
    });
    const store = started.ctx.adapter?.store as MemorySheetStore;
    const writesBefore = store.writeCount;
    await store.batchUpdate([
      {
        rowNumber: 2,
        columnIndex: EXAMPLE_HEADERS.indexOf("Phone"),
        header: "Phone",
        value: "+14155550999"
      }
    ]);
    const finalized = await started.app.inject({
      method: "POST",
      url: `/api/calls/${started.sessionId}/finalize`,
      headers: { cookie: started.cookie }
    });
    const proposal = finalized.json() as { id: string };
    const approved = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie: started.cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(409);
    expect((approved.json() as { code: string }).code).toBe("identity_conflict");
    expect(store.writeCount).toBe(writesBefore + 1);
    await started.app.close();
  });

  it("H9 Deepgram interruption marks the transcript incomplete", async () => {
    const llm = new FakeLlmClient();
    const started = await startConnectedCall({ llm });
    started.outbound?.fail(new Error("stream drop"));
    await vi.waitFor(async () => {
      const live = await started.app.inject({
        method: "GET",
        url: `/api/calls/${started.sessionId}`,
        headers: { cookie: started.cookie }
      });
      expect((live.json() as { transcriptionHealth: string }).transcriptionHealth).toBe("interrupted");
    });
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    const proposal = (
      await started.app.inject({
        method: "POST",
        url: `/api/calls/${started.sessionId}/finalize`,
        headers: { cookie: started.cookie }
      })
    ).json() as { transcriptComplete: boolean | null; confidence: number; warnings: string[] };
    expect(proposal.transcriptComplete).toBe(false);
    expect(proposal.confidence).toBeLessThan(0.5);
    expect(proposal.warnings.join(" ")).toMatch(/incomplete|skipped|failed/i);
    await started.app.close();
  });

  it("H10 malformed or unsafe LLM output is rejected", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueRaw("{not-json");
    llm.enqueueJson(coachOutput({ cue: "x".repeat(500) }));
    llm.enqueueJson(
      coachOutput({
        qualificationUpdates: [{ criterion: "not_a_real_field", state: "yes", evidence: "hello", confidence: 1 }]
      })
    );
    llm.enqueueJson(
      coachOutput({
        cue: "Our case study increased revenue 40% for customer Acme who achieved guaranteed results"
      })
    );
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal("can you walk me through how you work today");
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    started.outbound?.emitFinal("we ship a web product every other week");
    await vi.waitFor(() => expect(llm.calls.length).toBe(2));
    started.outbound?.emitFinal("the team is based in two offices");
    await vi.waitFor(() => expect(llm.calls.length).toBe(3));
    started.outbound?.emitFinal("what proof do you have this works");
    await vi.waitFor(() => expect(llm.calls.length).toBe(4));
    await new Promise((resolve) => setTimeout(resolve, 30));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    expect(live.json()).toMatchObject({ status: "in_progress", coach: { cue: null } });
    expect(listCoachingEvents(started.ctx.db, started.sessionId)).toHaveLength(0);
    await started.app.close();
  });

  it("H11 market research campaign asks for a concrete example and does not sell", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cueType: "question",
        cue: "Can you walk through a recent ship that later broke?",
        stage: "discovery"
      })
    );
    const started = await startConnectedCall({ llm, campaignId: "lamina-research" });
    started.outbound?.emitFinal("we look at stuff sometimes I guess");
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    const body = live.json() as { coach: { cue: { text: string; cueType: string } | null; recommendedOutcome: string | null } };
    expect(body.coach.cue?.text.toLowerCase()).toMatch(/recent|example|broke|ship/);
    expect(body.coach.cue?.cueType).not.toBe("objection");
    expect(body.coach.recommendedOutcome).not.toBe("meeting_booked");
    expect(llm.calls[0]?.system).not.toMatch(/the outcome is qualified/i);
    await started.app.close();
  });

  it("H12 networking campaign captures advice without sales-objection cues", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cueType: "question",
        cue: "Would a short follow-up next month be useful?",
        stage: "cta"
      })
    );
    const started = await startConnectedCall({ llm, campaignId: "lamina-networking" });
    started.outbound?.emitFinal("if I were you I would talk to operators before writing code");
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    const cue = (live.json() as { coach: { cue: { cueType: string; text: string } | null } }).coach.cue;
    expect(cue?.cueType).not.toBe("objection");
    expect(cue?.text.toLowerCase()).toMatch(/follow-up|next month|useful/);
    await started.app.close();
  });

  it("H13 Sheet write outage stays pending and retries once", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: yesCriteria,
        summary: "Contact described painful weekly regressions that cost the team two days."
      })
    );
    const started = await startConnectedCall({ llm });
    applyTransportStatus(started.ctx.db, started.sessionId, "completed");
    insertUtterance(started.ctx.db, {
      sessionId: started.sessionId,
      speaker: "contact",
      text: "painful weekly regressions that cost the team two days",
      startMs: 0,
      endMs: 400,
      confidence: 0.9
    });
    const store = started.ctx.adapter?.store as MemorySheetStore;
    store.failNextWrite();
    const finalized = await started.app.inject({
      method: "POST",
      url: `/api/calls/${started.sessionId}/finalize`,
      headers: { cookie: started.cookie }
    });
    const proposal = finalized.json() as { id: string };
    const failed = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie: started.cookie },
      payload: {}
    });
    expect((failed.json() as { proposal: { status: string } }).proposal.status).toBe("pending_retry");
    const retried = await started.app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/retry-write`,
      headers: { cookie: started.cookie }
    });
    expect((retried.json() as { proposal: { status: string } }).proposal.status).toBe("applied");
    const count = started.ctx.db
      .prepare("SELECT COUNT(*) AS n FROM post_call_proposals WHERE session_id = ?")
      .get(started.sessionId) as { n: number };
    expect(count.n).toBe(1);
    await started.app.close();
  });

  it("H14 approved-claims boundary rejects invented proof", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cue: "Acme saw a 40% lift in a guaranteed case study last quarter"
      })
    );
    const started = await startConnectedCall({ llm });
    started.outbound?.emitFinal("do you have proof this works for companies like ours");
    await vi.waitFor(() => expect(llm.calls.length).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const live = await started.app.inject({
      method: "GET",
      url: `/api/calls/${started.sessionId}`,
      headers: { cookie: started.cookie }
    });
    expect((live.json() as { coach: { cue: unknown }; status: string }).coach.cue).toBeNull();
    expect((live.json() as { status: string }).status).toBe("in_progress");
    await started.app.close();
  });
});
