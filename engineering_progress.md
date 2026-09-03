# Engineering Progress

Living build tracker for the AI Call Operator. Product requirements live in [`whatthis.md`](./whatthis.md). This file is the only place that records what is done, what is in progress, and what comes next.

## How to use this file

**Before planning or starting any phase, slice, or iteration:**

1. Read this file in full.
2. Read the matching sections of `whatthis.md` for the current slice.
3. Do not start a later slice while the current slice’s core acceptance checks are failing (`whatthis.md` §20).
4. Do not add features, services, or infrastructure that `whatthis.md` §4 lists as non-goals.

**After every build or iteration:**

1. Mark completed tasks `[x]`.
2. Leave blocked or unstarted tasks `[ ]`.
3. Set in-progress items in the status table to `in_progress`.
4. Append an entry to [Iteration log](#iteration-log).
5. Update **Current phase** and **Next action**.

Status values: `not_started` · `in_progress` · `blocked` · `completed`

---

## Current phase

| Field | Value |
|---|---|
| Phase | Slice 6 — Verification and hardening |
| Slice | 6 (code complete; live PSTN/Sheet smoke gated) |
| Status | `blocked` |
| Next action | Upgrade Twilio off Trial, buy Voice number + TwiML App, replace rejected OpenAI key, then run §19 smoke. Google Sheet mapping when ready (`SHEETS_BACKEND=google`). |
| Blocked on | Twilio Trial cannot create TwiML Applications and has no `TWILIO_CALLER_ID`; OpenAI key returns 401; Google Sheet deferred by operator. App runs on memory Sheet. |

---

## Phase overview

| ID | Slice | Status | Proof it is done |
|---|---|---|---|
| 0 | Repo bootstrap (this tracker + spec) | `completed` | `whatthis.md` and `engineering_progress.md` exist in the repo |
| 1 | CRM and preflight | `completed` | Login, Sheet adapter, eligible queue, ready-state UI, Sheet unit tests |
| 2 | Reliable Twilio call | `completed` | Fake-webhook tests pass; live controlled call still required before Slice 3 |
| 3 | Recording and transcription | `completed` | Dual Deepgram streams, live transcript, Recording SID, interruption UI (speaker map unconfirmed until live smoke) |
| 4 | Live coach | `completed` | One cue card, talk ratio, qualification indicators, stale-response handling (live model not required) |
| 5 | Post-call CRM update | `completed` | Review diff, approve & next, verified batch write, retry ledger (live Sheet smoke still required) |
| 6 | Verification and hardening | `blocked` | Holdouts H1–H14, Playwright (fakes), Docker recipe, README + VERIFICATION.md; live smoke still required |

Do not begin slice N+1 while slice N core acceptance tests are failing.

---

## Slice 0 — Repo bootstrap

- [x] Product spec available as `whatthis.md` (renamed from `ai-call-operator-spec.md`)
- [x] Engineering tracker created as `engineering_progress.md`
- [x] Cursor rule added so later sessions read and update this file (`.cursor/rules/engineering-progress.mdc`)
- [x] GitHub remote created (`shiv-eshwar/sales_engine`, private) and initial push
- [x] `README.md` stub (full README is Slice 6)

---

## Slice 1 — CRM and preflight

Source: `whatthis.md` §6–8, §15A, §16–17, §20 Slice 1.

### 1.1 Repository and runtime

- [x] One TypeScript repo, Node.js LTS, strict mode
- [x] React + Vite frontend, Tailwind CSS
- [x] Fastify backend serving API and built assets (WebSocket attach is Slice 3)
- [x] Zod, `yaml`, Pino, `better-sqlite3`
- [x] `.env.example` with placeholders only
- [x] `config/sheets.example.yaml` and campaign/playbook example YAML
- [x] SQL migrations directory; WAL mode; migrations run before ready

### 1.2 Auth and health

- [x] Single-user password login (`APP_PASSWORD_HASH`)
- [x] Signed HTTP-only Secure SameSite=Lax session cookie
- [x] Application API/WebSocket routes require the session
- [x] `/health/live` (no external calls)
- [x] `/health/ready` checks config, migrations, Sheet schema, provider setup without placing a call

### 1.3 Sheet adapter

- [x] Load `config/sheets.yaml`; never hard-code column letters
- [x] Startup header validation: every configured column exists exactly once
- [x] Missing/duplicate headers fail readiness with an actionable error; no Sheet writes
- [x] Identity is `lead_id`; blank/duplicate IDs rejected from the queue and reported
- [x] Phone normalized to E.164; invalid numbers not dialable
- [x] Eligible queue uses `eligible_when`; refresh after approve and on manual refresh
- [x] Write path: re-resolve by `lead_id`, match identity + phone snapshot, allowlisted cells only
- [x] One `batchUpdate` per approved outcome; formula-injection safe (`=`, `+`, `-`, `@`)
- [x] Read-back verification; failed write stored as `pending_retry` (Retry button is Slice 5 review UI)
- [x] Gumloop-owned columns never writable through any application path
- [x] Transcripts never written to Sheets

### 1.4 Ready-state UI

- [x] Campaign selector
- [x] Twilio device readiness placeholder (wired in Slice 2)
- [x] Sheet connectivity status
- [x] Next contact: name, role, company, phone
- [x] CRM/enrichment context and campaign objective
- [x] Required questions collapsed by default
- [x] Call, Skip, Refresh (Call disabled until Slice 2 telephony is ready)

### 1.5 Slice 1 tests

- [x] Header mapping survives reordered columns
- [x] Missing and duplicate headers fail preflight without any write
- [x] Writable-field validator rejects Gumloop-owned fields
- [x] Phone normalization accepts E.164-compatible inputs and rejects invalid numbers
- [x] Formula-like Sheet strings written as literal text

---

## Slice 2 — Reliable Twilio call

Source: `whatthis.md` §11, §15B (transport controls), §16, §20 Slice 2.

**Gate:** a real controlled-number call must work before Slice 3.

- [x] `POST /api/twilio/token` issues a short-lived Voice access token
- [x] One `Twilio.Device`; UI shows `registered` / `offline` / `error`
- [x] Click Call → server creates session, then `device.connect({ sessionId })` (never trust client-supplied destination)
- [x] TwiML webhook resolves session and dials server-validated E.164
- [x] Endpoints: `/twilio/voice/outbound`, `/twilio/voice/status`, `/twilio/voice/number-status`
- [x] Verify `X-Twilio-Signature` on every HTTP webhook
- [x] Twilio Call SID + event type used as idempotency keys
- [x] Distinct handling: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
- [x] Allowed destination countries; reject before contacting Twilio
- [x] Call, Mute/Unmute, Hang Up; no keypad
- [x] One simultaneous active call; second call rejected
- [x] `beforeunload` during an active call
- [x] Recording-notice reminder visible (compliance not claimed)
- [ ] Controlled real call to a user-owned test number succeeds (`blocked` on credentials)

### Slice 2 tests

- [x] Session state machine rejects illegal transitions and simultaneous calls
- [x] Browser-call session maps one lead ID to one Twilio session
- [x] Duplicate status callbacks are idempotent
- [x] Out-of-order Twilio callbacks converge on the correct terminal state

---

## Slice 3 — Recording and transcription

Source: `whatthis.md` §12, §15B (transcript), §20 Slice 3.

**Gate:** live speaker-to-track mapping is unconfirmed until a controlled PSTN smoke test. Default is `inbound → caller`, `outbound → contact`.

- [x] `WS /twilio/media` authenticated with a short-lived unguessable stream token
- [x] Handle Twilio `start`, `media`, `mark`, `stop`; preserve sequence numbers and track labels
- [x] One Deepgram stream per speaker track (`mulaw`, 8 kHz, interim, endpointing)
- [x] Map tracks to `caller` and `contact` (confirm in live smoke test; do not assume)
- [x] Persist finalized utterances only; interim is ephemeral and not evidence
- [x] Dual-channel recording from answer; store Recording SID, never a credentialed media URL
- [x] Deepgram reconnect: one immediate + one delayed while call is active
- [x] Transcript gaps marked; call continues if transcription fails
- [x] UI: live transcript, transcription health, `Transcription interrupted`
- [x] On hangup, flush streams up to 5 seconds; `transcript_complete: false` if gaps remain

### Slice 3 tests

- [x] Both audio tracks produce correctly attributed final utterances
- [x] Interim text never becomes qualification evidence
- [x] Transcription outage shows degraded state; call controls still work

Live speaker-map confirmation is **not** required to merge Slice 3 code.

---

## Slice 4 — Live coach

Source: `whatthis.md` §9–10, §13, §15B (cue card), §20 Slice 4.

**Gate:** a live model call is not required to merge Slice 4 code. Prove with an injectable fake LLM.

- [x] Campaign YAML loader (sales / research / networking); restart to pick up changes
- [x] Playbook `config/playbooks/cold-calling.yaml` editable without TypeScript changes
- [x] `LLMClient` behind `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`
- [x] Call continues with no coaching if the LLM is unavailable
- [x] Trigger only on connected call + final meaningful contact utterance + 3s rate limit (except urgent DNC)
- [x] Stale responses discarded by transcript sequence
- [x] Bounded context: rolling summary + last 20 utterances
- [x] Validate structured output; invalid output → no cue, never raw model text
- [x] Evidence and approved-claims validators
- [x] One cue card; `shouldShow: false` allowed; max 160 characters
- [x] Deterministic talk ratio from utterance timings; warn if caller > 40% after 60s connected
- [x] Compact qualification criteria indicators; `unknown` until evidence exists
- [x] Sales objection first cue clarifies/diagnoses, does not rebut

### Slice 4 tests

- [x] Campaign YAML validates; forbidden values fail startup
- [x] Qualification reducer preserves `unknown` without evidence
- [x] Configured disqualifiers map to deterministic recommendations
- [x] Talk ratio calculated from timestamps, not the model
- [x] Live-coach schema rejects oversized cues and unknown criteria
- [x] Evidence validator rejects qualification evidence absent from context
- [x] Stale coaching responses discarded
- [x] Invalid model JSON produces no live cue and does not end the call

---

## Slice 5 — Post-call CRM update

Source: `whatthis.md` §14, §15C–D, §20 Slice 5.

- [x] Non-connect outcomes (busy / failed / no-answer / canceled / invalid): no LLM; increment attempts once; Retry or Skip
- [x] Connected finalization: stop coaching, flush Deepgram, one post-call extraction, store proposal
- [x] Review UI: transport vs semantic outcome, evidence, warnings, field-level Sheet diff
- [x] User may edit only application-owned proposed values
- [x] **Approve & next**: re-validate, one batch write, read-back, mark applied, load next lead
- [x] Write failure retains proposal and Retry; never drop it
- [x] Identity/phone mismatch blocks write and requires resolution
- [x] `do_not_contact` is visually prominent; approved DNC never reappears as eligible
- [x] Daily summary from SQLite ledger (no charts)

### Slice 5 tests

- [x] No-answer/busy/failed updates do not invoke the LLM
- [x] Semantic proposal does not write before approval
- [x] Approved outcome writes one batch to only allowlisted cells and verifies the result
- [x] Failed Sheet write remains pending and succeeds on retry without duplication
- [x] Gumloop changes to owned cells during the call remain intact

---

## Slice 6 — Verification and hardening

Source: `whatthis.md` §18–22, §20 Slice 6.

- [x] Holdouts H1–H14 as fixture-driven integration tests (prompts must not contain expected answers verbatim)
- [x] Playwright E2E against faked providers (login → call → transcript → one cue → review → approve)
- [x] Invalid Sheet schema: blocking error, no Call button
- [x] SIGTERM: stop new sessions, preserve ledger, do not kill an active PSTN call for coaching shutdown
- [x] One Dockerfile; one production build; persistent SQLite volume
- [x] `README.md` (setup, non-goals, troubleshooting, privacy warning)
- [x] `VERIFICATION.md` (commit, tests, holdouts, smoke evidence, speaker mapping, latencies)
- [x] Operator runbook section
- [ ] Controlled live smoke test on a user-owned number (`whatthis.md` §19)

---

## Holdouts (`whatthis.md` §18)

| ID | Scenario | Status |
|---|---|---|
| H1 | Qualified sales lead + existing-solution objection | `completed` |
| H2 | Clear disqualification | `completed` |
| H3 | Insufficient qualification evidence | `completed` |
| H4 | Do-not-contact | `completed` |
| H5 | No answer | `completed` |
| H6 | Duplicate and reordered provider events | `completed` |
| H7 | Gumloop edits the row during a call | `completed` |
| H8 | Lead identity conflict | `completed` |
| H9 | Deepgram interruption | `completed` |
| H10 | Malformed or unsafe LLM output | `completed` |
| H11 | Market research campaign | `completed` |
| H12 | Networking campaign | `completed` |
| H13 | Sheet write outage | `completed` |
| H14 | Approved-claims boundary | `completed` |

---

## User inputs (`whatthis.md` §23)

These do not block scaffolding or tests. They block production Sheet mapping and live calling.

| Input | Status | Notes |
|---|---|---|
| Exact Google Sheet header row | `not_started` | Example YAML must not be assumed to match production |
| One anonymized example lead row | `not_started` | |
| Gumloop-owned columns | `not_started` | |
| Application-writable columns | `not_started` | |
| Campaign definitions (sales / research / networking) | `not_started` | Objective, claims, questions, qualification, outcomes |
| Allowed calling countries | `not_started` | |
| Recording notice policy and retention | `not_started` | Default ledger retention 90 days until specified |
| Runtime credentials in local/deploy secrets | `in_progress` | Local `.env` has Deepgram + Twilio account/API keys + LLM env; OpenAI key 401; Twilio TwiML App SID + caller ID missing (Trial). Keys were pasted in chat — rotate. |

---

## Final acceptance (`whatthis.md` §22)

- [x] One command starts local development after configuration
- [x] One production build creates the single deployable service
- [x] No secrets or real call data are committed
- [x] Sheet schema preflight is blocking and non-mutating
- [x] Gumloop-owned columns cannot be written through any application code path
- [ ] Browser Twilio calling works on a controlled real call
- [ ] Both speakers are transcribed and attributed correctly
- [x] Live cues are structured, short, rate-limited, and evidence/claim validated
- [x] Qualification cannot become positive without configured evidence
- [x] Objection handling begins with acknowledgement/clarification/diagnosis rather than argument
- [x] Non-connected calls avoid LLM costs
- [x] Post-call semantic updates require review
- [x] Sheet write is atomic at the application level, verified, and retryable
- [x] Duplicate provider events are idempotent
- [x] DNC leads are suppressed from future eligibility
- [x] Sales, research, and networking campaigns produce purpose-appropriate cues
- [x] All holdout scenarios pass
- [ ] Live smoke test passes and speaker mapping is documented
- [x] README and VERIFICATION are complete

---

## Iteration log

| When | What changed | Phase after |
|---|---|---|
| 2026-09-02 | Imported spec as `whatthis.md` (renamed from `ai-call-operator-spec.md`). Created this tracker and the always-on Cursor rule to read/update it before each phase. Repo still has no application code. | Slice 0 in progress; Slice 1 is next |
| 2026-09-02 | Added `.gitignore`, created private GitHub repo `shiv-eshwar/sales_engine`, and pushed the initial commit. | Slice 0 complete; Slice 1 is next |
| 2026-09-02 | Slice 1: TypeScript app, login, SQLite ledger, YAML Sheet adapter with memory fixture, ready-state UI, Vitest 16/16. Call remains disabled. Retry UI for pending writes is Slice 5. | Slice 1 complete; Slice 2 is next |
| 2026-09-02 | Slice 2: Twilio token, server sessions, signed TwiML/status webhooks, Call/Mute/Hang Up UI. Vitest 26/26. Live PSTN call still needs Twilio credentials. | Slice 2 code complete; live call blocked |
| 2026-09-02 | Slice 3: dual-track Media Streams, Deepgram STT fakes, Recording SID webhook, live transcript UI. Vitest 36/36. Speaker map unconfirmed until live smoke. | Slice 3 code complete; live transcription blocked |
| 2026-09-02 | Slice 4: injectable LLM coach, one cue card, talk ratio, qualification reducer, stale discard. Vitest 52/52. Live model still needs credentials. | Slice 4 code complete; live coaching blocked |
| 2026-09-02 | Slice 5: post-call extraction, review UI, Approve & next, retry ledger, DNC suppression, daily summary. Live Sheet/PSTN smoke still required. | Slice 5 code complete; live approve-and-next blocked |
| 2026-09-02 | Slice 6: named holdouts H1–H14, Playwright E2E against faked Twilio/Deepgram/LLM, invalid-schema Call disable, SIGTERM drain, Dockerfile, README + operator runbook + VERIFICATION.md. Live §19 smoke still blocked on credentials. | Slice 6 code complete; live smoke blocked |
| 2026-09-02 | Recorded Slice 6 commit SHA `e03c2c8` in VERIFICATION.md. Docker image `sales-engine` built. Production `/health/ready` confirms memory Sheet + auth; Twilio/Deepgram/LLM still unset so PSTN smoke cannot run. | Slice 6 code complete; live smoke blocked |
| 2026-09-03 | Wired local `.env` (memory Sheet, Deepgram OK, Twilio keys without number/TwiML App, LLM key rejected by OpenAI). ngrok installed + tunnel. Production server on `:3000` ready; Call disabled until paid Twilio number + TwiML App. Operator notes in gitignored `.local-run.txt`. | Slice 6 blocked on Trial Twilio + valid OpenAI key + Sheet |
| 2026-09-03 | Added `scripts/start-local.sh`, `scripts/tunnel.sh`, `scripts/status.sh` and `npm run start:local`. Verified login → bootstrap → memory lead queue. Goal handoff complete for local operator use; PSTN + Sheet deferred per Trial/credentials. | Local setup complete; live smoke blocked |
