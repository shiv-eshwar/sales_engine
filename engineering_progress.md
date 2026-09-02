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
| Phase | Slice 2 — Reliable Twilio call |
| Slice | 2 (not started) |
| Status | `not_started` |
| Next action | Token endpoint, Twilio Device, session creation, TwiML, call controls. A controlled real call is the gate before Slice 3. |
| Blocked on | Twilio credentials and a user-owned test number. Slice 1 scaffolding does not require them. |

---

## Phase overview

| ID | Slice | Status | Proof it is done |
|---|---|---|---|
| 0 | Repo bootstrap (this tracker + spec) | `completed` | `whatthis.md` and `engineering_progress.md` exist in the repo |
| 1 | CRM and preflight | `completed` | Login, Sheet adapter, eligible queue, ready-state UI, Sheet unit tests |
| 2 | Reliable Twilio call | `not_started` | Controlled real call; Call / Mute / Hang Up; idempotent webhooks |
| 3 | Recording and transcription | `not_started` | Dual Deepgram streams, live transcript, Recording SID, interruption UI |
| 4 | Live coach | `not_started` | One cue card, talk ratio, qualification indicators, stale-response handling |
| 5 | Post-call CRM update | `not_started` | Review diff, approve & next, verified batch write, retry ledger |
| 6 | Verification and hardening | `not_started` | Holdouts H1–H14, Playwright, Docker, live smoke test, README + VERIFICATION.md |

Do not begin slice N+1 while slice N core acceptance tests are failing.

---

## Slice 0 — Repo bootstrap

- [x] Product spec available as `whatthis.md` (renamed from `ai-call-operator-spec.md`)
- [x] Engineering tracker created as `engineering_progress.md`
- [x] Cursor rule added so later sessions read and update this file (`.cursor/rules/engineering-progress.mdc`)
- [x] GitHub remote created (`shiv-eshwar/sales_engine`, private) and initial push
- [ ] `README.md` stub (full README is Slice 6)

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

- [ ] `POST /api/twilio/token` issues a short-lived Voice access token
- [ ] One `Twilio.Device`; UI shows `registered` / `offline` / `error`
- [ ] Click Call → server creates session, then `device.connect({ sessionId })` (never trust client-supplied destination)
- [ ] TwiML webhook resolves session and dials server-validated E.164
- [ ] Endpoints: `/twilio/voice/outbound`, `/twilio/voice/status`, `/twilio/voice/number-status`
- [ ] Verify `X-Twilio-Signature` on every HTTP webhook
- [ ] Twilio Call SID + event type used as idempotency keys
- [ ] Distinct handling: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
- [ ] Allowed destination countries; reject before contacting Twilio
- [ ] Call, Mute/Unmute, Hang Up; no keypad
- [ ] One simultaneous active call; second call rejected
- [ ] `beforeunload` during an active call
- [ ] Recording-notice reminder visible (compliance not claimed)
- [ ] Controlled real call to a user-owned test number succeeds

### Slice 2 tests

- [ ] Session state machine rejects illegal transitions and simultaneous calls
- [ ] Browser-call session maps one lead ID to one Twilio session
- [ ] Duplicate status callbacks are idempotent
- [ ] Out-of-order Twilio callbacks converge on the correct terminal state

---

## Slice 3 — Recording and transcription

Source: `whatthis.md` §12, §15B (transcript), §20 Slice 3.

- [ ] `WS /twilio/media` authenticated with a short-lived unguessable stream token
- [ ] Handle Twilio `start`, `media`, `mark`, `stop`; preserve sequence numbers and track labels
- [ ] One Deepgram stream per speaker track (`mulaw`, 8 kHz, interim, endpointing)
- [ ] Map tracks to `caller` and `contact` (confirm in live smoke test; do not assume)
- [ ] Persist finalized utterances only; interim is ephemeral and not evidence
- [ ] Dual-channel recording from answer; store Recording SID, never a credentialed media URL
- [ ] Deepgram reconnect: one immediate + one delayed while call is active
- [ ] Transcript gaps marked; call continues if transcription fails
- [ ] UI: live transcript, transcription health, `Transcription interrupted`
- [ ] On hangup, flush streams up to 5 seconds; `transcript_complete: false` if gaps remain

### Slice 3 tests

- [ ] Both audio tracks produce correctly attributed final utterances
- [ ] Interim text never becomes qualification evidence
- [ ] Transcription outage shows degraded state; call controls still work

---

## Slice 4 — Live coach

Source: `whatthis.md` §9–10, §13, §15B (cue card), §20 Slice 4.

- [ ] Campaign YAML loader (sales / research / networking); restart to pick up changes
- [ ] Playbook `config/playbooks/cold-calling.yaml` editable without TypeScript changes
- [ ] `LLMClient` behind `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`
- [ ] Call continues with no coaching if the LLM is unavailable
- [ ] Trigger only on connected call + final meaningful contact utterance + 3s rate limit (except urgent DNC)
- [ ] Stale responses discarded by transcript sequence
- [ ] Bounded context: rolling summary + last 20 utterances
- [ ] Validate structured output; invalid output → no cue, never raw model text
- [ ] Evidence and approved-claims validators
- [ ] One cue card; `shouldShow: false` allowed; max 160 characters
- [ ] Deterministic talk ratio from utterance timings; warn if caller > 40% after 60s connected
- [ ] Compact qualification criteria indicators; `unknown` until evidence exists
- [ ] Sales objection first cue clarifies/diagnoses, does not rebut

### Slice 4 tests

- [ ] Campaign YAML validates; forbidden values fail startup
- [ ] Qualification reducer preserves `unknown` without evidence
- [ ] Configured disqualifiers map to deterministic recommendations
- [ ] Talk ratio calculated from timestamps, not the model
- [ ] Live-coach schema rejects oversized cues and unknown criteria
- [ ] Evidence validator rejects qualification evidence absent from context
- [ ] Stale coaching responses discarded
- [ ] Invalid model JSON produces no live cue and does not end the call

---

## Slice 5 — Post-call CRM update

Source: `whatthis.md` §14, §15C–D, §20 Slice 5.

- [ ] Non-connect outcomes (busy / failed / no-answer / canceled / invalid): no LLM; increment attempts once; Retry or Skip
- [ ] Connected finalization: stop coaching, flush Deepgram, one post-call extraction, store proposal
- [ ] Review UI: transport vs semantic outcome, evidence, warnings, field-level Sheet diff
- [ ] User may edit only application-owned proposed values
- [ ] **Approve & next**: re-validate, one batch write, read-back, mark applied, load next lead
- [ ] Write failure retains proposal and Retry; never drop it
- [ ] Identity/phone mismatch blocks write and requires resolution
- [ ] `do_not_contact` is visually prominent; approved DNC never reappears as eligible
- [ ] Daily summary from SQLite ledger (no charts)

### Slice 5 tests

- [ ] No-answer/busy/failed updates do not invoke the LLM
- [ ] Semantic proposal does not write before approval
- [ ] Approved outcome writes one batch to only allowlisted cells and verifies the result
- [ ] Failed Sheet write remains pending and succeeds on retry without duplication
- [ ] Gumloop changes to owned cells during the call remain intact

---

## Slice 6 — Verification and hardening

Source: `whatthis.md` §18–22, §20 Slice 6.

- [ ] Holdouts H1–H14 as fixture-driven integration tests (prompts must not contain expected answers verbatim)
- [ ] Playwright E2E against faked providers (login → call → transcript → one cue → review → approve)
- [ ] Invalid Sheet schema: blocking error, no Call button
- [ ] SIGTERM: stop new sessions, preserve ledger, do not kill an active PSTN call for coaching shutdown
- [ ] One Dockerfile; one production build; persistent SQLite volume
- [ ] `README.md` (setup, non-goals, troubleshooting, privacy warning)
- [ ] `VERIFICATION.md` (commit, tests, holdouts, smoke evidence, speaker mapping, latencies)
- [ ] Operator runbook section
- [ ] Controlled live smoke test on a user-owned number (`whatthis.md` §19)

---

## Holdouts (`whatthis.md` §18)

| ID | Scenario | Status |
|---|---|---|
| H1 | Qualified sales lead + existing-solution objection | `not_started` |
| H2 | Clear disqualification | `not_started` |
| H3 | Insufficient qualification evidence | `not_started` |
| H4 | Do-not-contact | `not_started` |
| H5 | No answer | `not_started` |
| H6 | Duplicate and reordered provider events | `not_started` |
| H7 | Gumloop edits the row during a call | `not_started` |
| H8 | Lead identity conflict | `not_started` |
| H9 | Deepgram interruption | `not_started` |
| H10 | Malformed or unsafe LLM output | `not_started` |
| H11 | Market research campaign | `not_started` |
| H12 | Networking campaign | `not_started` |
| H13 | Sheet write outage | `not_started` |
| H14 | Approved-claims boundary | `not_started` |

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
| Runtime credentials in local/deploy secrets | `not_started` | Never paste into source or chat |

---

## Final acceptance (`whatthis.md` §22)

- [ ] One command starts local development after configuration
- [ ] One production build creates the single deployable service
- [ ] No secrets or real call data are committed
- [ ] Sheet schema preflight is blocking and non-mutating
- [ ] Gumloop-owned columns cannot be written through any application code path
- [ ] Browser Twilio calling works on a controlled real call
- [ ] Both speakers are transcribed and attributed correctly
- [ ] Live cues are structured, short, rate-limited, and evidence/claim validated
- [ ] Qualification cannot become positive without configured evidence
- [ ] Objection handling begins with acknowledgement/clarification/diagnosis rather than argument
- [ ] Non-connected calls avoid LLM costs
- [ ] Post-call semantic updates require review
- [ ] Sheet write is atomic at the application level, verified, and retryable
- [ ] Duplicate provider events are idempotent
- [ ] DNC leads are suppressed from future eligibility
- [ ] Sales, research, and networking campaigns produce purpose-appropriate cues
- [ ] All holdout scenarios pass
- [ ] Live smoke test passes and speaker mapping is documented
- [ ] README and VERIFICATION are complete

---

## Iteration log

| When | What changed | Phase after |
|---|---|---|
| 2026-09-02 | Imported spec as `whatthis.md` (renamed from `ai-call-operator-spec.md`). Created this tracker and the always-on Cursor rule to read/update it before each phase. Repo still has no application code. | Slice 0 in progress; Slice 1 is next |
| 2026-09-02 | Added `.gitignore`, created private GitHub repo `shiv-eshwar/sales_engine`, and pushed the initial commit. | Slice 0 complete; Slice 1 is next |
| 2026-09-02 | Slice 1: TypeScript app, login, SQLite ledger, YAML Sheet adapter with memory fixture, ready-state UI, Vitest 16/16. Call remains disabled. Retry UI for pending writes is Slice 5. | Slice 1 complete; Slice 2 is next |
