# AI Call Operator — Product Specification (`whatthis.md`)

**Status:** Build-ready MVP specification  
**Audience:** Implementation agent  
**Product type:** Single-user internal tool  
**Source of truth:** This file is the product spec. Do not add features that are not required here. Track build status in `engineering_progress.md`.  
**Primary goal:** Reliably call contacts from a fixed Google Sheet through Twilio, transcribe calls in real time with Deepgram, provide concise campaign-aware live coaching, and write verified call outcomes back to the same Sheet.

---

## 1. Instructions to Codex

Implement this specification as written. Optimize for the shortest reliable path to a working internal tool. Do not add features, abstractions, services, frameworks, or infrastructure that are not required by this document.

Before writing code:

1. Inspect the repository and preserve any existing relevant work.
2. Produce a short implementation plan mapped to the acceptance criteria in this specification.
3. Identify missing configuration values, but do not block scaffolding or tests on credentials.
4. Never commit secrets, service-account JSON, recordings, transcripts, or real lead data.
5. Implement in vertical slices. Make a real Twilio call work before adding live AI coaching.
6. Treat the holdout scenarios in Section 18 as outcome-level verification requirements. Do not weaken them merely to make tests pass.

Definition of done: all automated checks pass, a production build succeeds, the application completes the live smoke test in Section 19 using a test phone number, and the verification report records evidence for every acceptance criterion.

---

## 2. Product Summary

Build a browser-based AI call operator for one internal user. Google Sheets is the CRM. Gumloop continuously sources and enriches leads into a Sheet with a fixed header structure. The application reads eligible contacts from that Sheet, places human-operated outbound calls through the Twilio Voice JavaScript SDK, receives real-time call audio through Twilio Media Streams, transcribes both sides with Deepgram, and shows one concise next-best-action cue at a time.

At the end of each call, the application creates a structured proposed CRM update. The user reviews it and presses **Approve & next**. The application updates only its allowlisted columns in the correct lead row and loads the next eligible contact.

The system supports three campaign purposes through configuration rather than separate implementations:

- **Sales:** qualify or disqualify, handle objections, and secure an appropriate next step.
- **Market research:** ask non-leading questions, obtain concrete evidence, and capture exact language without pitching.
- **Job/networking:** understand context, build rapport, obtain advice, and earn an appropriate follow-up or introduction.

The sales campaign must implement the cold-calling flow and coaching principles described in Section 10.

---

## 3. MVP Success Criteria

The MVP succeeds when the user can:

1. Sign in to the internal web application.
2. Select a campaign and load the next eligible lead from Google Sheets.
3. See the lead's CRM context and the campaign objective.
4. Click **Call** and speak to the prospect directly in the browser through Twilio.
5. See a real-time transcript with caller and prospect correctly separated.
6. Receive at most one useful, short, campaign-appropriate cue at a time.
7. See deterministic talk-time ratio and qualification progress during sales calls.
8. End the call and receive a structured, evidence-backed proposed outcome.
9. Review the exact Google Sheet fields that will change.
10. Approve the update and load the next eligible lead.
11. Recover safely from duplicate webhooks, transcription interruption, malformed model output, Sheet changes, and transient write failures.

Target operational metrics, measured during the live smoke test:

- Partial transcript visible within 1.5 seconds of speech under normal network conditions.
- New coaching cue visible within 3 seconds of a finalized prospect utterance under normal network conditions.
- No more than one coaching-model request per 3 seconds per call.
- Next eligible lead loads within 2 seconds for a Sheet containing up to 5,000 rows.
- No unauthorized Sheet column changes in any automated or live test.
- Duplicate Twilio callbacks cause zero duplicate CRM writes.

These latency targets are operational goals, not reasons to discard correct results when an external provider is slow.

---

## 4. Explicit Non-Goals

Do not implement any of the following in the MVP:

- Autonomous AI speaking to prospects.
- Text-to-speech or Vapi in the live human call path.
- Automatic dialing without a user click.
- Power dialer, parallel dialer, predictive dialer, queues for multiple callers, or teams.
- Inbound calling, transfers, conference calling, or call barging.
- Email, WhatsApp, SMS, calendar, or automated follow-up sending.
- Web research or browser automation.
- Lead sourcing or enrichment; Gumloop owns it.
- A second CRM or editable pipeline database.
- A vector database, RAG framework, LangGraph, Redis, Kafka, queues, microservices, Kubernetes, or a multi-agent framework.
- Self-modifying playbooks or qualification rules.
- Automatic promotion of learned objection responses.
- Analytics dashboards beyond the minimal daily summary defined here.
- Mobile application or packaged desktop application.

Vapi credits may be used later for roleplay practice. They must not be required for MVP operation.

---

## 5. System Boundaries and Ownership

| Component | Owns | Must never own |
|---|---|---|
| Gumloop | Lead discovery, enrichment, and writes to Gumloop-owned Sheet columns | Call outcomes, qualification, recordings, coaching |
| Google Sheets | Canonical CRM, current lead state, contact context | Real-time call state or transient transcript buffering |
| Web application | User workflow, live UI, review, and configuration display | Provider secrets or direct arbitrary Sheet access |
| Twilio | PSTN connectivity, Twilio call state, media stream, recording | Transcription, qualification, or CRM decisions |
| Deepgram | Streaming speech recognition and utterance boundaries | Sales advice or CRM mutations |
| Coaching engine | Advisory call-stage inference and one next-best-action cue | Speaking on the call or writing to the CRM |
| Post-call processor | Proposed structured outcome with evidence | Unreviewed semantic CRM mutation |
| SQLite call ledger | Idempotency, call/session linkage, transcript events, pending updates | Acting as the CRM or replacing Sheets |
| User | Initiating calls and approving semantic CRM updates | Manual transcription or routine note entry |

### Hard behavioral boundaries

1. The AI is advisory during a call. It cannot hang up, mute, dial, speak, or update the CRM.
2. Only deterministic call metadata may be written automatically: attempt count, call timestamp, Twilio call SID, and terminal transport outcome such as busy/no-answer/failed.
3. Semantic fields such as qualification, summary, pain, objections, and next step require user approval.
4. The application may update only columns explicitly declared writable in `config/sheets.yaml`.
5. The application must never overwrite Gumloop-owned columns, even when they change during a call.
6. Qualification is determined from campaign-defined criteria and transcript evidence. The model may not invent its own qualification framework.
7. The coaching model may use only campaign configuration, approved playbook material, Sheet context, and the current call transcript. It must not browse the web.
8. A missing fact remains `unknown`; it must never be guessed.

---

## 6. Technology Stack

Use one TypeScript repository and one deployable Node.js process.

### Required stack

- **Runtime:** Current Node.js LTS.
- **Language:** TypeScript with strict mode.
- **Frontend:** React + Vite.
- **Styling:** Tailwind CSS. Use simple accessible primitives; avoid adding a large component system unless already present.
- **Backend:** Fastify.
- **WebSocket server:** Fastify WebSocket support or the `ws` package attached to the same HTTP server.
- **Telephony client:** `@twilio/voice-sdk`.
- **Telephony server:** Official `twilio` Node SDK.
- **Transcription:** Official Deepgram Node SDK or a direct WebSocket client if the SDK obstructs raw Twilio audio forwarding.
- **Google Sheets:** Official `googleapis` package using a service account.
- **Local ledger:** SQLite through `better-sqlite3`; use explicit SQL migrations. Do not add an ORM.
- **Validation:** Zod for configuration, webhook payloads, model output, and API contracts.
- **YAML:** `yaml` package for versioned campaign and Sheet configuration.
- **Logging:** Pino through Fastify. Redact secrets and personal content.
- **Tests:** Vitest for unit/integration tests; Playwright for browser end-to-end tests.
- **Packaging:** One Dockerfile and `docker compose` only if it materially simplifies local startup. No additional services are allowed.

### Deployment shape

The production MVP is one HTTPS-accessible container with WebSocket support and one persistent volume for SQLite. It serves the built React assets and all API/WebSocket routes. It must work on a platform such as Railway, Fly.io, Render, or a small VM. Do not couple application code to a specific host.

For local development, use a Cloudflare Tunnel or ngrok so Twilio can reach the HTTPS webhook and WSS media endpoint. The production deployment must not depend on a temporary development tunnel.

### Model provider

Use an OpenAI-compatible chat-completions or responses client behind a small `LLMClient` interface:

```ts
interface LLMClient {
  generateStructured<T>(input: {
    task: "live_coach" | "post_call" | "daily_coach";
    schema: z.ZodType<T>;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    timeoutMs: number;
  }): Promise<T>;
}
```

Configure it with `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. Do not hard-code one model vendor. The app must continue the call without coaching if the LLM is unavailable.

---

## 7. Repository Structure

Use a simple structure similar to:

```text
/
  src/
    client/
      components/
      pages/
      state/
      twilio/
    server/
      api/
      auth/
      calls/
      coaching/
      config/
      deepgram/
      db/
      sheets/
      twilio/
      index.ts
    shared/
      contracts.ts
      schemas.ts
      types.ts
  config/
    sheets.example.yaml
    campaigns/
      sales.example.yaml
      research.example.yaml
      networking.example.yaml
    playbooks/
      cold-calling.yaml
  migrations/
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  scripts/
    preflight.ts
    smoke-test.ts
  .env.example
  Dockerfile
  README.md
  SPEC.md
  VERIFICATION.md
```

Do not split this into packages or a monorepo.

---

## 8. Google Sheets CRM Contract

Google Sheets is the only CRM. The Sheet already has a fixed structure and is updated by Gumloop. The application must adapt through header-name configuration and must never alter the Sheet schema.

### Required configuration

Create `config/sheets.yaml` from this shape:

```yaml
spreadsheet_id: "configured-outside-source-control"
sheet_name: "Leads"
header_row: 1
identity_column: "Lead ID"

read_columns:
  lead_id: "Lead ID"
  full_name: "Full Name"
  phone: "Phone"
  company: "Company"
  role: "Job Title"
  enrichment: "Enrichment"
  campaign_id: "Campaign"
  crm_status: "Status"

write_columns:
  call_status: "Call Status"
  call_attempts: "Call Attempts"
  last_called_at: "Last Called At"
  call_outcome: "Call Outcome"
  qualification: "Qualification"
  qualification_reason: "Qualification Reason"
  objections: "Objections"
  next_step: "Next Step"
  follow_up_at: "Follow Up At"
  call_summary: "Call Summary"
  twilio_call_sid: "Twilio Call SID"
  recording_sid: "Recording SID"

eligible_when:
  crm_status: ["Ready", "Retry"]
  call_status: ["", "Retry"]

ownership:
  gumloop_owned:
    - "Lead ID"
    - "Full Name"
    - "Phone"
    - "Company"
    - "Job Title"
    - "Enrichment"
    - "Campaign"
    - "Status"
  application_owned:
    - "Call Status"
    - "Call Attempts"
    - "Last Called At"
    - "Call Outcome"
    - "Qualification"
    - "Qualification Reason"
    - "Objections"
    - "Next Step"
    - "Follow Up At"
    - "Call Summary"
    - "Twilio Call SID"
    - "Recording SID"
```

The real column names will be supplied by the user. The example configuration must not be assumed to match production.

### Sheet adapter requirements

1. On startup, read the header row and validate every configured column exists exactly once.
2. Fail readiness with an actionable error if a configured header is missing or duplicated. Do not modify the Sheet.
3. Build header-to-column indexes dynamically. Never hard-code column letters or depend on a permanent row number.
4. Use the immutable configured identity value (`lead_id`) as the CRM identity.
5. Reject blank or duplicate lead IDs from the eligible queue and report them in diagnostics.
6. Normalize phone numbers to E.164 before calling. Invalid numbers are not dialable and must be shown as configuration/data errors.
7. Fetch at most the ranges needed for queue and selected-lead operations.
8. Refresh the eligible queue after every approved update and when the user presses refresh.
9. Before a write, re-resolve the row by `lead_id`, verify the configured identity and phone still match the call snapshot, and update only allowlisted application-owned cells.
10. Write all fields for one approved outcome in one Sheets `batchUpdate` operation.
11. Use RAW input semantics or escape leading `=`, `+`, `-`, and `@` where required to prevent formula injection.
12. After writing, read back the application-owned fields and verify the intended values.
13. If verification fails, store the proposed update in SQLite as `pending_retry`, show a visible error, and provide a Retry action. Never silently discard it.
14. Never write transcripts into Sheets. Store only concise summaries and structured fields.

### Conflict rule

If Gumloop changes a Gumloop-owned cell while a call is active, preserve its new value. The application writes only its cells. If the lead ID or phone changes, block the semantic write and require user resolution because the called contact can no longer be proven to match the current row.

---

## 9. Campaign Configuration

Campaigns are versioned YAML files loaded on startup. Changes require an application restart in MVP. Do not build a campaign editor.

Common schema:

```yaml
id: "lamina-sales"
name: "Lamina founder sales"
type: "sales" # sales | research | networking
version: 1
objective: "Qualify the UX verification problem and secure a focused follow-up"

opening_context: |
  Brief approved context the caller may use.

approved_claims:
  - id: "claim_1"
    text: "Exact approved factual claim"
    evidence: "Internal source or case-study reference"

required_questions:
  - id: "current_workflow"
    prompt: "How do you currently verify user-facing behavior?"
    required: true

forbidden_behaviors:
  - "invent_case_studies"
  - "promise_guaranteed_results"
  - "argue_with_contact"

success_outcomes:
  - "meeting_booked"
  - "permission_to_follow_up"
  - "reference_received"
  - "callback_later"

terminal_outcomes:
  - "not_interested"
  - "disqualified"
  - "do_not_contact"
  - "wrong_number"

qualification:
  criteria:
    relevant_problem:
      prompt: "Does the contact have the problem this campaign addresses?"
      required_for_qualified: true
    meaningful_cost:
      prompt: "Does the problem impose meaningful cost, risk, or friction?"
      required_for_qualified: true
    influence:
      prompt: "Can the contact make or influence the next decision?"
      required_for_qualified: true
    timing:
      prompt: "Is there a plausible reason to act in the configured time window?"
      required_for_qualified: false
  disqualifiers:
    - "no_relevant_problem"
    - "wrong_company_type"
    - "no_influence_and_no_referral"
    - "existing_solution_fully_satisfies_need"
    - "explicit_do_not_contact"
```

### Campaign-type behavior

**Sales**

- Optimize for diagnosis, qualification, and an appropriate next step.
- Use the cold-calling flow in Section 10.
- Surface objections and evidence-backed handling cues.
- Never label a lead qualified until every required criterion has transcript evidence or explicit CRM evidence.

**Research**

- Optimize for valid evidence, concrete recent examples, exact language, and unanswered hypotheses.
- Avoid pitching unless the campaign explicitly permits it and the contact asks.
- Detect leading questions and suggest a neutral alternative.
- Qualification means suitability as a research participant, not purchase likelihood.

**Networking**

- Optimize for learning, reciprocity, relationship context, and an appropriate follow-up or introduction.
- Do not emit aggressive closing or sales-objection cues.
- Capture advice, promised actions by either party, potential introductions, and relationship context.

---

## 10. Sales Playbook and Live Coaching Rules

Store the sales playbook in `config/playbooks/cold-calling.yaml`. It must be editable without changing TypeScript.

### Call flow

The live coach tracks one of these stages:

1. `opener`
2. `hook`
3. `problem`
4. `discovery`
5. `qualification`
6. `value_proposition`
7. `objection`
8. `cta`
9. `closed`

The flow is not a rigid script. The contact can move backward, skip a stage, or raise an objection at any point.

### Required principles

1. Prefer flows and intent over memorized scripts.
2. Keep the caller near 25% talk time and the contact near 75% where possible. This is coaching guidance, not a hard call-validity rule.
3. Focus on the problem and its consequences before explaining the product or service.
4. Prefer concise questions that cause the contact to describe their situation.
5. Treat clear rejection and disqualification as useful outcomes; do not pressure every contact toward a meeting.
6. A cold sales call may successfully produce one of four intermediate outcomes: meeting, permission to send/follow up, relevant reference/introduction, or later callback.
7. Do not argue with objections.
8. Every cue must be short enough to scan while speaking: maximum 160 characters and preferably one sentence.
9. Do not display a cue merely to fill space. `should_show: false` is valid.
10. Never invent customer names, results, prices, integrations, guarantees, or claims.

### Objection handling flow

For an objection, guide the caller through:

```text
acknowledge → clarify → diagnose → answer from approved evidence → confirm
```

The first cue should normally clarify or diagnose rather than rebut.

Objection taxonomy:

- `not_interested`
- `bad_timing`
- `send_information`
- `existing_solution`
- `in_house_team`
- `no_budget`
- `too_expensive`
- `no_authority`
- `need_to_think`
- `trust_or_risk`
- `busy_now`
- `wrong_person`
- `do_not_contact`
- `other`

Playbook entries may contain approved diagnostic questions and responses. The model may adapt wording but may not introduce unapproved factual claims.

### Qualification model

Each criterion has:

```ts
type CriterionState = {
  state: "yes" | "no" | "unknown";
  evidence: string | null;
  source: "transcript" | "crm" | null;
  confidence: number;
};
```

Do not use a single opaque lead score. Produce:

- `qualified` when every required criterion is `yes`.
- `disqualified` when a configured disqualifier has clear evidence.
- `defer` when timing is later or a better contact is needed.
- `unknown` when evidence is insufficient.

The live agent may recommend these states; the post-call review controls the CRM value.

---

## 11. Telephony Flow

### Browser client

1. Authenticated client requests a short-lived token from `POST /api/twilio/token`.
2. Server creates a Twilio Voice access token with a stable single-user identity and the configured TwiML application SID.
3. Client constructs one `Twilio.Device` and reports `registered`, `offline`, and `error` state visibly.
4. On user click, client creates a call session server-side, then calls `device.connect()` with an opaque `sessionId`. Do not send the destination number as a trusted client instruction to TwiML.
5. The TwiML webhook resolves the session, retrieves the server-side validated E.164 number, and returns the dial instructions.
6. UI provides Call, Mute/Unmute, and Hang Up. Do not implement a numeric keypad.

### Twilio webhook flow

Required endpoints:

- `POST /twilio/voice/outbound` — returns TwiML for the browser-originated call.
- `POST /twilio/voice/status` — receives parent call lifecycle events.
- `POST /twilio/voice/number-status` — receives destination leg lifecycle events.
- `POST /twilio/recording/status` — receives recording availability/failure.
- `WS /twilio/media` — receives media events.

Requirements:

1. Verify `X-Twilio-Signature` on every HTTP webhook using the exact public URL Twilio called.
2. Authenticate the WebSocket using an unguessable, short-lived stream token passed as a Twilio custom parameter; do not place provider secrets in the URL.
3. Reject unknown, expired, completed, or mismatched sessions.
4. Use Twilio Call SIDs and event type as idempotency keys.
5. Record from answer in dual-channel mode where supported. Store Recording SID; never place Twilio credentials in a recording URL.
6. Request both media tracks for transcription. Confirm actual track-to-speaker mapping in the live smoke test and document it in `VERIFICATION.md`.
7. Handle `queued`, `ringing`, `in-progress`, `completed`, `busy`, `failed`, `no-answer`, and `canceled` distinctly.
8. Do not invoke the LLM for calls that never connect.
9. A `completed` transport status does not imply a human conversation; preserve the distinction between Twilio transport outcome and semantic call outcome.
10. Configure allowed destination countries. Reject calls outside the allowlist before contacting Twilio.

### Recording consent

Add configuration for recording notice requirements. The UI must visibly remind the caller to provide the configured notice before substantive conversation. Do not claim that the application automatically guarantees legal compliance across jurisdictions.

---

## 12. Real-Time Transcription

Use Twilio Media Streams and Deepgram streaming STT.

### Audio processing

1. Accept Twilio `start`, `media`, `mark`, and `stop` messages.
2. Preserve Twilio sequence numbers and track labels.
3. Forward each speaker track to a dedicated Deepgram streaming connection. This is simpler and less error-prone than constructing interleaved multichannel audio.
4. Configure Deepgram for Twilio audio: `mulaw`, 8 kHz, streaming conversational model, interim results, word timings, endpointing, and utterance-end events.
5. Make model name and language configurable. Default to an appropriate current English conversational model available to the account.
6. Map the two tracks to `caller` and `contact`. Verify this mapping with a real controlled call before production use.
7. Persist finalized utterances to SQLite. Interim text is ephemeral and may be pushed to the UI but must not be treated as evidence.

### Transcript event

```ts
type TranscriptUtterance = {
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
```

### Reliability behavior

- If one Deepgram connection fails, attempt one immediate reconnect and one delayed reconnect while the call remains active.
- Do not replay audio already acknowledged by Deepgram unless a bounded buffer permits exact sequence replay without duplication.
- Mark transcript gaps explicitly with timestamps.
- Continue the Twilio call even if transcription fails.
- Show `Transcription interrupted` in the UI; do not show stale cues as if they were current.
- On call end, flush both streams for up to 5 seconds and then finalize with `transcript_complete: false` if gaps remain.

---

## 13. Live Coaching Engine

### Triggering

Run coaching only when:

- the call is connected;
- a final contact utterance has arrived;
- the utterance contains meaningful text;
- at least 3 seconds have elapsed since the previous model request, unless a configured urgent event such as `do_not_contact` is deterministically detected;
- no request for the same or newer transcript sequence is already in flight.

Cancel or ignore stale model responses using the transcript sequence number.

### Context construction

The model receives:

1. Campaign type, objective, success outcomes, forbidden behaviors, qualification rules, and approved claims.
2. Selected lead CRM snapshot.
3. Deterministic current state: call duration, talk ratio, known criteria, unresolved criteria, prior objections, and current stage.
4. A bounded transcript context: rolling summary plus the most recent finalized utterances.
5. Current playbook rules relevant to the detected stage/objection.

Do not resend the full call transcript indefinitely. Maintain a rolling factual summary when context exceeds the configured threshold, while retaining the last 20 utterances verbatim.

### Structured output

```ts
const LiveCoachOutput = z.object({
  basedOnSequence: z.number().int(),
  stage: z.enum([
    "opener", "hook", "problem", "discovery", "qualification",
    "value_proposition", "objection", "cta", "closed"
  ]),
  shouldShow: z.boolean(),
  cueType: z.enum([
    "question", "objection", "listen", "clarify", "qualify",
    "disqualify", "cta", "warning", "none"
  ]),
  cue: z.string().max(160),
  reason: z.string().max(240),
  detectedObjection: z.string().nullable(),
  qualificationUpdates: z.array(z.object({
    criterion: z.string(),
    state: z.enum(["yes", "no", "unknown"]),
    evidence: z.string().nullable(),
    confidence: z.number().min(0).max(1)
  })),
  recommendedOutcome: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});
```

Server validation rules:

1. Reject unknown qualification criteria and outcome enums.
2. Reject evidence not present in the transcript/CRM context.
3. Reject factual cue claims that cannot be matched to approved campaign claims.
4. Replace invalid output with no cue; never pass raw model text to the live UI.
5. Do not show low-confidence cues below the configured threshold.
6. A new cue replaces the prior cue. Never create a scrolling chat feed.

### Deterministic metrics

Calculate talk time from finalized word/utterance timings by speaker. The LLM does not calculate talk ratio. Show a gentle warning only when the caller has spoken more than 40% after at least 60 seconds of connected conversation.

---

## 14. Post-Call Processing and CRM Update

### Transport outcomes

For `busy`, `failed`, `no-answer`, `canceled`, or invalid number:

- do not call the LLM;
- increment attempts once;
- write the deterministic transport outcome;
- preserve semantic fields;
- allow the user to choose Retry or Skip according to configuration.

### Connected call finalization

After the call ends:

1. Stop accepting new coaching tasks.
2. Flush Deepgram for up to 5 seconds.
3. Assemble finalized utterances in sequence order.
4. Run the post-call structured extraction once.
5. Store the proposal in SQLite.
6. Display a field-level diff against current Sheet values.
7. User can edit only application-owned proposed values.
8. On **Approve & next**, validate again, write one batch to Sheets, verify the write, mark the proposal applied, and load the next lead.
9. On write failure, retain the proposal and provide Retry. Never lose it.

### Post-call schema

```ts
const PostCallOutcome = z.object({
  semanticOutcome: z.enum([
    "meeting_booked", "permission_to_follow_up", "reference_received",
    "callback_later", "not_interested", "disqualified", "do_not_contact",
    "wrong_person", "conversation_incomplete", "unknown"
  ]),
  qualification: z.enum(["qualified", "disqualified", "defer", "unknown"]),
  qualificationReason: z.string().max(500),
  criteria: z.record(z.object({
    state: z.enum(["yes", "no", "unknown"]),
    evidence: z.string().nullable(),
    confidence: z.number().min(0).max(1)
  })),
  painOrResearchFindings: z.array(z.string().max(300)).max(8),
  objections: z.array(z.string().max(200)).max(8),
  nextStep: z.string().max(500),
  followUpAt: z.string().datetime().nullable(),
  summary: z.string().max(1000),
  callerCommitments: z.array(z.string().max(300)).max(8),
  contactCommitments: z.array(z.string().max(300)).max(8),
  transcriptComplete: z.boolean(),
  confidence: z.number().min(0).max(1)
});
```

All non-empty claims require evidence traceability internally. Store evidence utterance IDs in SQLite even if the compact Sheet fields do not contain them.

### Do-not-contact

The review UI must make `do_not_contact` visually prominent. When approved, write the configured suppression status so Gumloop and the application can exclude the contact. The application must never surface an approved DNC lead as eligible again.

---

## 15. User Interface

Build one responsive desktop-first page with state-driven panels. Do not build a CRM dashboard.

### A. Ready state

Display:

- campaign selector;
- Twilio device readiness;
- Sheet connectivity status;
- next contact: name, role, company, phone;
- CRM/enrichment context;
- campaign objective;
- required call questions collapsed by default;
- **Call** and **Skip** buttons;
- manual Refresh.

### B. Calling/live state

Display:

- contact identity and connected duration;
- transport state: connecting, ringing, connected, ending;
- one large AI cue card;
- current stage;
- compact qualification criteria indicators;
- caller/contact talk ratio;
- transcription health;
- collapsible live transcript;
- Mute and Hang Up;
- recording-notice reminder;
- no other navigation that can accidentally abandon the call.

### C. Review state

Display:

- transport outcome;
- AI semantic outcome;
- qualification and evidence;
- objections/findings;
- next step and follow-up date;
- concise summary;
- warnings for incomplete transcript or low confidence;
- exact field-level Sheet diff;
- **Approve & next**, **Edit**, **Retry processing**, and **Discard proposal** with confirmation.

### D. Daily summary

Minimal, derived from the SQLite call ledger:

- attempts;
- connects;
- qualified/disqualified/unknown;
- meetings/follow-ups/references/callbacks;
- no-answer/busy/failed;
- average talk ratio;
- one evidence-backed coaching observation.

Do not build charts in MVP.

### Accessibility and call safety

- All controls are keyboard accessible.
- Call state is not communicated by color alone.
- Hang Up is visible but visually distinct from Call.
- Prevent accidental page close during an active call with `beforeunload`.
- Disable Call while a session is active.
- Never auto-start microphone permission or a call without user interaction.

---

## 16. SQLite Ledger

SQLite is an operational ledger, not a CRM.

Minimum tables:

```text
call_sessions
  id, lead_id, campaign_id, campaign_version, lead_snapshot_json,
  status, twilio_parent_sid, twilio_child_sid, recording_sid,
  started_at, connected_at, ended_at, transport_outcome,
  transcript_complete, created_at, updated_at

transcript_utterances
  id, session_id, speaker, text, start_ms, end_ms,
  confidence, sequence, created_at

coaching_events
  id, session_id, based_on_sequence, stage, cue_type,
  cue, reason, output_json, shown_at, created_at

post_call_proposals
  id, session_id, proposed_json, evidence_json, status,
  approved_json, sheet_write_attempts, last_error,
  created_at, approved_at, applied_at

webhook_events
  idempotency_key, provider, event_type, payload_hash,
  processed_at, result
```

Requirements:

- Enable WAL mode.
- Run migrations at startup before readiness succeeds.
- Use transactions for webhook idempotency and session transitions.
- Enforce unique constraints on Twilio SIDs where present and on webhook idempotency keys.
- Do not log full transcripts or service-account contents.
- Support configurable retention. Default: recordings remain in Twilio according to Twilio configuration; local transcript/ledger retention is 90 days.

---

## 17. Security and Reliability Requirements

### Authentication

This is a single-user internal tool. Implement one password configured through `APP_PASSWORD_HASH` or an equivalent secret. On successful login, issue a signed, HTTP-only, Secure, SameSite=Lax session cookie. Do not add an external auth provider.

Protect all application API and browser WebSocket routes. Twilio routes use signature/session-token verification rather than the browser cookie.

### Secrets

Required environment variables should include:

```text
APP_BASE_URL
APP_PASSWORD_HASH
SESSION_SECRET
TWILIO_ACCOUNT_SID
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_AUTH_TOKEN
TWILIO_TWIML_APP_SID
TWILIO_CALLER_ID
TWILIO_ALLOWED_COUNTRIES
DEEPGRAM_API_KEY
DEEPGRAM_MODEL
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
SHEETS_CONFIG_PATH
DATABASE_PATH
```

Provide `.env.example` with placeholder values only.

### Reliability

- `/health/live` returns process liveness without external calls.
- `/health/ready` verifies configuration, DB migrations, Sheet schema, and required provider setup without placing a call.
- Use timeouts for every external request.
- Use bounded retries with jitter for Sheets and post-call LLM calls. Do not retry live coaching indefinitely.
- Return clear UI errors with retry actions.
- Handle SIGTERM: stop accepting new sessions, preserve active ledger state, and close resources. Do not terminate an active Twilio PSTN call solely because coaching is shutting down.
- Webhook handlers must respond quickly; persist the event and perform nonessential work asynchronously in-process.
- The application supports one simultaneous active call. Reject a second active call deterministically.

### Privacy

- Do not log transcript text or raw lead enrichment in production by default.
- Redact authorization headers, cookies, API keys, phone numbers, and Google credentials.
- Provide a user-visible indication that recording/transcription is active.
- Store Recording SID, not a credential-bearing media URL.

---

## 18. Verification Strategy and Holdout Scenarios

Codex must create `VERIFICATION.md` mapping every acceptance criterion to automated or manual evidence. Tests must verify outcomes, not merely that functions were called.

### Unit tests

At minimum:

1. Sheet header mapping survives reordered columns.
2. Missing and duplicate headers fail preflight without any write.
3. Writable field validator rejects Gumloop-owned fields.
4. Phone normalization accepts valid E.164-compatible inputs and rejects invalid numbers.
5. Campaign YAML validates and forbidden campaign values fail startup.
6. Qualification reducer preserves `unknown` without evidence.
7. Configured disqualifiers map to deterministic recommendations.
8. Talk ratio is calculated from timestamps, not model output.
9. Live-coach schema rejects oversized cues and unknown criteria.
10. Evidence validator rejects qualification evidence absent from context.
11. Formula-like Sheet strings are safely written as literal text.
12. Session state machine rejects illegal transitions and simultaneous calls.

### Integration tests with fakes

Create in-process fakes for Twilio webhooks/media events, Deepgram results, the LLM, and Google Sheets. Do not hit paid services in the default test suite.

Verify:

1. Browser-call session maps one lead ID to one Twilio session.
2. Duplicate status and recording callbacks are idempotent.
3. Out-of-order Twilio callbacks converge on the correct terminal state.
4. Both audio tracks produce correctly attributed final utterances.
5. Interim text never becomes qualification evidence.
6. Stale coaching responses are discarded.
7. Invalid model JSON produces no live cue and does not end the call.
8. No-answer/busy/failed updates do not invoke the LLM.
9. Semantic proposal does not write before approval.
10. Approved outcome writes one batch to only allowlisted cells and verifies the result.
11. Failed Sheet write remains pending and succeeds on retry without duplication.
12. Gumloop changes to owned cells during the call remain intact.

### Browser E2E tests

Using Playwright and faked backend providers:

1. Login → select campaign → load lead → initiate call → see ringing/connected state.
2. Live transcript updates with speaker labels.
3. Only one coaching card is visible and stale cards do not accumulate.
4. Mute/unmute and hang-up controls update UI state correctly.
5. Review screen shows exact CRM diff.
6. Approve → success confirmation → next lead loads.
7. Transcription outage shows degraded state while call controls continue working.
8. Invalid Sheet schema presents a blocking actionable error without a Call button.

### Holdout outcome scenarios

Implement these as fixture-driven integration tests. The implementation prompts must not contain the expected final answers verbatim.

#### H1 — Qualified sales lead with existing-solution objection

- Contact confirms a relevant painful problem, meaningful cost, influence, and near-term interest.
- Mid-call they say they already use another solution.
- Expected: coach first suggests clarification/diagnosis, not an unsupported rebuttal; final recommendation is qualified; objection and evidence are captured; proposed outcome is meeting or follow-up based on transcript.

#### H2 — Clear disqualification

- Contact explicitly states the company does not have the relevant problem and their current process fully meets the need.
- Expected: coach stops pushing; final outcome is disqualified with the exact configured reason and evidence; no meeting is fabricated.

#### H3 — Insufficient qualification evidence

- Friendly conversation but authority, severity, and timing never become clear.
- Expected: qualification remains unknown, not qualified; next cue prioritizes one missing high-value criterion.

#### H4 — Do-not-contact

- Contact explicitly asks not to be called again.
- Expected: immediate warning cue to acknowledge and end respectfully; approved outcome writes DNC suppression; lead never reappears.

#### H5 — No answer

- Twilio emits ringing then no-answer.
- Expected: no transcription or LLM request; attempt and transport status update exactly once.

#### H6 — Duplicate and reordered provider events

- Repeat status/recording events and deliver completion before a delayed in-progress event.
- Expected: one terminal call, one CRM attempt update, no state regression, no duplicate proposal.

#### H7 — Gumloop edits the row during a call

- Gumloop changes enrichment and status while the call is active.
- Expected: post-call write updates only application columns and preserves Gumloop values.

#### H8 — Lead identity conflict

- The row's lead ID or phone changes before approval.
- Expected: block write and require resolution; do not write to a guessed row.

#### H9 — Deepgram interruption

- Contact audio transcription disconnects for part of the call.
- Expected: call continues; UI reports interruption; final proposal marks transcript incomplete and avoids confident conclusions unsupported by captured evidence.

#### H10 — Malformed or unsafe LLM output

- LLM returns invalid JSON, a 500-character cue, unknown criteria, or an invented case study.
- Expected: output rejected; no unsafe cue displayed; call continues.

#### H11 — Market research campaign

- Contact gives a vague answer to a research question.
- Expected: coach requests a recent concrete example and avoids selling language; output captures finding and exact phrasing, not sales qualification.

#### H12 — Networking campaign

- Contact offers advice but no job or introduction.
- Expected: coach suggests an appropriate follow-up/reciprocity question; does not emit sales objection handling; outcome captures advice and next relationship step.

#### H13 — Sheet write outage

- Sheets API fails after user approval, then recovers.
- Expected: proposal remains pending with visible error; retry applies exactly once and read-back verifies it.

#### H14 — Approved-claims boundary

- Contact asks for proof that is absent from campaign approved claims.
- Expected: coach advises honest uncertainty or a follow-up; it does not invent proof.

---

## 19. Live Smoke Test

After automated tests pass, perform this controlled test using a phone number owned by the user. Do not cold-call an external lead during verification.

1. Add a test lead to a test Sheet using the production header structure.
2. Verify startup preflight and readiness.
3. Open the application in a supported desktop Chromium browser.
4. Confirm Twilio device readiness and microphone selection.
5. Call the user's controlled test number.
6. Speak distinct phrases from each side and verify correct speaker labels.
7. Raise an `existing_solution` objection and verify the cue asks to clarify/diagnose.
8. State clear qualification evidence and agree to a fictional next step.
9. End the call.
10. Verify Twilio terminal status, Recording SID, finalized transcript, proposal, evidence, and field-level Sheet diff.
11. Approve the proposal.
12. Verify the correct lead row changed, Gumloop-owned cells did not change, and a duplicate callback does not apply a second update.
13. Record actual transcript and cue latency measurements without copying PII into `VERIFICATION.md`.

The live smoke test is incomplete until audio-track speaker mapping is proven rather than assumed.

---

## 20. Build Sequence

Implement in these vertical slices:

### Slice 1 — CRM and preflight

- Repository, configuration loader, SQLite migrations, login.
- Sheet adapter, schema/ownership validation, eligible lead loading.
- Ready-state UI.
- Unit tests for all Sheet boundaries.

### Slice 2 — Reliable Twilio call

- Token endpoint, Twilio Device, session creation, TwiML, destination status.
- Call controls and transport-state UI.
- Webhook verification and idempotent ledger.
- Real controlled-number call before proceeding.

### Slice 3 — Recording and transcription

- Media Stream authentication and handling.
- Two Deepgram streams, final utterance persistence, live transcript.
- Recording callback and Recording SID.
- Interruption/degraded behavior.

### Slice 4 — Live coach

- Campaign/playbook schemas and loaders.
- Deterministic call state and talk ratio.
- Bounded context, structured LLM output, evidence/claim validators.
- One-card UI and stale-response handling.

### Slice 5 — Post-call CRM update

- Structured extraction, evidence links, diff review.
- Safe batch write, read-back verification, retry ledger.
- Next-lead flow and deterministic non-connect updates.

### Slice 6 — Verification and hardening

- All holdouts, Playwright flows, health endpoints, Docker build.
- Controlled live smoke test.
- Complete `README.md` and `VERIFICATION.md`.

Do not begin later slices while core acceptance tests for the current slice are failing.

---

## 21. Required Documentation

### README.md

Include:

- what the application does and does not do;
- architecture overview;
- local prerequisites;
- Twilio account/TwiML application/number setup;
- Deepgram setup;
- Google service-account and Sheet-sharing setup;
- Sheet config mapping instructions;
- LLM configuration;
- local tunnel setup;
- local run, test, build, migration, and deployment commands;
- backup and recovery of SQLite;
- troubleshooting for microphone, Twilio device, webhook signature, speaker mapping, Deepgram connection, and Sheet schema failures;
- recording/privacy warning.

### VERIFICATION.md

Include:

- exact commit tested;
- test commands and results;
- acceptance-criterion matrix;
- holdout results;
- live smoke-test evidence;
- actual measured latencies;
- confirmed audio-track mapping;
- any known limitations or deferred risks.

### Operator runbook

Include a short section explaining:

1. what to check before a calling session;
2. how to recover a pending Sheet write;
3. how to handle transcription degradation;
4. how to stop calling and mark DNC;
5. how to change campaign YAML safely;
6. how to verify Gumloop and application column ownership remain disjoint.

---

## 22. Final Acceptance Checklist

The project is complete only when all are true:

- [ ] One command starts local development after configuration.
- [ ] One production build creates the single deployable service.
- [ ] No secrets or real call data are committed.
- [ ] Sheet schema preflight is blocking and non-mutating.
- [ ] Gumloop-owned columns cannot be written through any application code path.
- [ ] Browser Twilio calling works on a controlled real call.
- [ ] Both speakers are transcribed and attributed correctly.
- [ ] Live cues are structured, short, rate-limited, and evidence/claim validated.
- [ ] Qualification cannot become positive without configured evidence.
- [ ] Objection handling begins with acknowledgement/clarification/diagnosis rather than argument.
- [ ] Non-connected calls avoid LLM costs.
- [ ] Post-call semantic updates require review.
- [ ] Sheet write is atomic at the application level, verified, and retryable.
- [ ] Duplicate provider events are idempotent.
- [ ] DNC leads are suppressed from future eligibility.
- [ ] Sales, research, and networking campaigns produce purpose-appropriate cues.
- [ ] All holdout scenarios pass.
- [ ] Live smoke test passes and speaker mapping is documented.
- [ ] README and VERIFICATION are complete.

---

## 23. Inputs Required From the User

Codex should request only these missing inputs and continue implementing everything else with fixtures:

1. Exact Google Sheet header row.
2. One anonymized example lead row.
3. Which columns Gumloop owns.
4. Which existing columns the application may update.
5. Campaign definitions: sales/research/networking objective, approved claims, required questions, qualification criteria, disqualifiers, and valid outcomes.
6. Allowed calling countries.
7. Desired recording notice policy and retention period.
8. Runtime credentials placed locally or in deployment secrets—not pasted into source or chat.

If the full cold-calling course transcript is available, save it as a source reference and extract additional playbook rules into YAML. Do not embed copyrighted transcript text in application prompts beyond the user's own concise derived rules.

