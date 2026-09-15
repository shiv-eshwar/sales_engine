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
| Phase | Slice 7 — Live coach feed + operator-approved Calendar |
| Slice | 7 (code complete; Slice 6 live PSTN smoke still gated) |
| Status | `completed` |
| Next action | Confirm public `APP_BASE_URL` (trycloudflare) matches TwiML App, then run §19 live PSTN smoke and fill speaker mapping in `VERIFICATION.md`. |
| Blocked on | Slice 6 live controlled PSTN smoke / speaker mapping. Production Calendar OAuth is connected. Google Sheet is connected; Azure auto-deploy from `main` is live. |

---

## Azure auto-deploy (ops)

Does not replace Slice 6 live smoke. Proof of done: a `main` push shows a green **Deploy Sales Engine** workflow and `/health/ready` on the VM.

- [x] `scripts/deploy-production.sh` (fetch `origin/main`, `npm ci` + build, release symlink, restart `sales-engine`, health checks)
- [x] `scripts/install-github-actions-ssh.sh` (VM: Actions SSH key + passwordless `systemctl` for this service)
- [x] `.github/workflows/deploy.yml` (SSH on push to `main` and `workflow_dispatch`)
- [x] VM: run the installer as `azureuser`
- [x] GitHub secrets `AZURE_HOST`, `AZURE_USER`, `AZURE_SSH_KEY`
- [x] VM `git fetch origin main` works without a password prompt
- [x] Reconcile VM-only commits (push them or accept `reset --hard origin/main`)
- [x] First green production deploy (`b93d418` → `/opt/sales-engine/releases/20260913113855`, `/health/ready` ok)

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
| 7 | Live coach feed + approved Calendar | `completed` | Append-only coach messages, two-way thread, operator OAuth Calendar, Approve-only send; typecheck + 202 Vitest + 9 Playwright (Calendar fakes, email/password auth, last-call context) |

Slice 6 live PSTN smoke is a holdout. Slice 7 does not wait on it. Do not begin later slices while the current slice’s core automated checks are failing.

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

- [x] Email/password accounts in SQLite (`/login` + `/signup`); signed HTTP-only Secure SameSite=Lax session cookie
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

## Slice 7 — Live coach feed + operator-approved Calendar

Source: `whatthis.md` §4, §13, §15B, §20 Slice 7.

**Gate:** live Google Calendar and live PSTN are not required to merge Slice 7 code. Prove with injectable fake LLM + fake Calendar. Slice 6 live smoke stays blocked.

- [x] Append-only `coach_messages` persisted and replayed on WebSocket connect
- [x] WS `{ type: "coach_message" }` plus compact snapshot (stage, talk ratio); latest cue still available on GET for existing tests
- [x] Live-coach schema allows ~400 character `say`/`cue` and optional `calendarProposal` (draft only)
- [x] Transcript trigger rules unchanged; operator composer `POST /api/calls/:id/coach/chat` is not rate-limited the same way
- [x] Two-way CoachThread in CallingPanel; drop live qualification chips; DNC stays pinned; talk-ratio warn is a coach line
- [x] Operator Google OAuth (`calendar.events`), encrypted token store (`SESSION_SECRET`), connect/status/disconnect routes
- [x] `get_calendar_availability` is read-only; `propose_calendar_event` never inserts; Approve inserts once; Dismiss; failed retry
- [x] Shared CalendarEventCard on live coach and call-review; post-call extraction has no Calendar tools
- [x] Fake Calendar client for unit/integration/Playwright; README OAuth setup; still no auto-send
- [x] Event intents `meeting` | `callback` | `reminder`; operator-only events use `sendUpdates: none`; optional `calendarReminder` bundle

### Slice 7 tests

- [x] Feed append + stale discard
- [x] Composer turn
- [x] Propose does not insert; approve inserts once; dismiss; review can propose
- [x] Playwright uses Calendar fakes (no live Google)

### Operator email/password auth

Proof: typecheck + 195 Vitest (`tests/unit/auth.test.ts`, `tests/integration/auth.test.ts`, `tests/unit/theme.test.ts`) + 8 Playwright (`tests/e2e/auth.spec.ts` plus operator/campaign journeys now fill `/login`). No Google login. No Supabase. Calendar OAuth stays Settings-only.

- [x] `users` table; scrypt password hashes; signup `POST /api/signup`; login `POST /api/login`
- [x] Signed HTTP-only session cookie with user id; `requireSession` returns 401
- [x] `/login` and `/signup` pages; Settings Account + Sign out
- [x] `SESSION_SECRET` required for `/health/ready` auth check
- [x] Auth pages share a quiet mint wash (same-hue blobs, reduced-motion freeze)
- [x] Light/dark theme toggle (evergreen dark, mint accent, persisted in this browser)

### Eve skills + pre-call scan

Proof: Vitest including `tests/unit/agents.test.ts`, `tests/unit/prospect-brief.test.ts`, and stored-vs-generated schema tests. No §4 non-goals. No shared `agents/skills/` library.

- [x] Relevant book packs live under each agent `skills/` (live-coach Farrokh+Blount, prospect-research Farrokh+Sobczak, campaign-generation Weinberg+Sobczak, campaign-interview Weinberg, post-call Sobczak+Blount, call-review none)
- [x] Loader advertises skill descriptions and preloads `cheatsheet.md` only (never chapters / SKILL.md dumps)
- [x] Agent `instructions.md` rewritten for role, stakes, standing rules, and output contract
- [x] Prospect brief schema caps tightened for new LLM output; lead brief UI is Say this / Ask this / If they push back / Leave with

### Caller UX pass (audit P0 / scoped P1)

Proof: Playwright `tests/e2e/operator.spec.ts` + `campaigns.spec.ts` (6/6) and Vitest including `tests/unit/ui-copy.test.ts`. No power dialer, auto-dial, or extra dashboards.

- [x] Home is one call queue in Sheet order; the next dialable row is Up next with Call as the primary action and Skip as outline; lead detail still uses the contact card
- [x] Last-call context on Up next / lead detail: last dial vs last conversation, attempt count, who called (session user), and `follow_up_at` as a wait line. Fed into prospect brief + live coach. No team queues.
- [x] Optional header Dial pad: custom E.164 in allowed countries, no Sheet write, hang-up returns Home
- [x] First-run is an empty-state card, not an auto-opened campaign drawer
- [x] Every eligible Sheet row is in the selected campaign queue (no assign-leads UI)
- [x] Disabled Generate looks disabled; AI copy does not name env vars
- [x] Live HUD: sticky Mute/Hang Up, large cue, keypad collapsed behind “Need to press a key?”
- [x] Live call hides New campaign, disables campaign switching, intercepts Ready navigation
- [x] After review write or discard, operator returns to Home `/leads`
- [x] Queue defaults to dialable (`Ready to call`); undialable split via “need a phone fix”
- [x] One product name (Mantis); one readiness chip
- [x] Call is large; opening + first question on Ready; long brief behind Prep
- [x] Ringing / muted / interrupted / DNC live treatments
- [x] Review: human labels, technical details collapsed, enum dropdowns, pinned Approve & next
- [x] Review is an agentic chat (`POST /api/calls/:id/review/interview` + `call-review` agent); confirm write still uses approve → Sheet batch; first turn auto-summarizes the proposal
- [x] Narrow queue uses stacked cards, not a 720px table

### HeroUI + campaign chat

Proof: Playwright `tests/e2e/operator.spec.ts` + `campaigns.spec.ts` and Vitest including interview + eve agent tests. No §4 non-goals.

- [x] Caller-facing Ready / live HUD / review chrome uses HeroUI (Button, Card, Alert, Chip, Modal)
- [x] Campaign creation is an in-app interview chat (assistant-ui + `campaign-interview` agent), not a form
- [x] Campaign form/drawer fields removed; POST `/api/campaigns` remains for tests and internal use
- [x] Merged P0/P1 caller workflow kept: Home queue Up next, pinned live HUD, review → Home

### Operator UI rebuild (Refactoring UI)

Proof: Playwright `tests/e2e/operator.spec.ts` + `campaigns.spec.ts` (6/6) and Vitest 137. Visual pass against screenshots of empty, Ready, lead detail, sheet connect, diagnostics.

- [x] HSL grey/primary/accent scales, hand-crafted type and spacing tokens, ~5 elevations, one 8px radius (no pill mix)
- [x] Feature-first Home queue: Up next row is the only solid Call; Skip outline; Refresh tertiary
- [x] Empty campaign is a first-class screen with accent bar and one CTA; header chrome de-emphasized
- [x] Live HUD keeps same-hue secondaries on the dark ground (no grey-on-navy)
- [x] Review ranks semantic outcome over label:value dumps; Approve stays the pinned primary
- [x] Breadcrumbs removed from operator pages (lead detail, analytics, notifications, review). Navbar Mantis / Home covers return.

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
| Exact Google Sheet header row | `completed` | Live Sheet1 expanded to full CRM headers matching `config/sheets.yaml` |
| One anonymized example lead row | `completed` | `TEST-20260906-001` / +12025550123 / Status Ready |
| Gumloop-owned columns | `completed` | Spec example ownership used in `config/sheets.yaml` |
| Application-writable columns | `completed` | Spec example ownership used in `config/sheets.yaml` |
| Campaign definitions (sales / research / networking) | `not_started` | Objective, claims, questions, qualification, outcomes |
| Allowed calling countries | `not_started` | |
| Recording notice policy and retention | `not_started` | Default ledger retention 90 days until specified |
| Runtime credentials in local/deploy secrets | `in_progress` | Local `.env` has Google SA + Sheet config (gitignored), Twilio Voice fields, Deepgram, LLM. GitHub Actions secrets `AZURE_HOST`, `AZURE_USER`, `AZURE_SSH_KEY` are set. Rotate any keys that were pasted in chat. |

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
| 2026-09-06 | Wired live Google Sheets CRM: `config/sheets.yaml` (gitignored), service-account base64 in `.env`, Sheet1 headers expanded to full CRM contract, test lead `TEST-20260906-001`. `/health/ready` reports Sheet schema valid (google); bootstrap returns Test Contact. | Google CRM live; PSTN smoke still gated |
| 2026-09-06 | Removed password login gate: open access to API and UI; Sign out removed; e2e opens Ready page directly. | Open access; PSTN smoke still gated |
| 2026-09-07 | Live Twilio E2E: fresh tunnel, TwiML app rewired, allowlist +IN, webhooks 204 via public URL; PSTN ring to user-owned +91 blocked by Twilio Geo Permissions (21215); evidence in VERIFICATION.md (commit `c8b4716` on main). | Slice 6 code complete; live smoke blocked on geo-permission + Sheet test row |
| 2026-09-07 | Adopted Vercel eve for AI: `agents/` holds live-coach, post-call, campaign-generation, prospect-research (`agent.ts` + `instructions.md`); `src/server/agents/loader.ts` renders prompts for the existing LLM transport. Typecheck + 98 Vitest + 5 Playwright pass; prompts byte-identical. | Slice 6 code complete; live smoke blocked on geo-permission + Sheet test row |
| 2026-09-12 | Caller UX P0 + scoped P1 from the visual audit: Ready next-up card, assign leads, live three-zone HUD, Approve & next to the next Ready panel. Typecheck + 127 Vitest + 6 Playwright. No §4 non-goals. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Book skills landed under `agents/skills/` (Farrokh, Blount, Weinberg, Sobczak). Live-coach playbook v2 distills opener → Problem Proposition → Miyagi/RBO so connected-call cues use them automatically. Typecheck + 128 Vitest. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | HeroUI on caller surfaces; campaign creation is assistant-ui chat plus an interview agent (`POST /api/campaigns/interview`). Form editor removed. P0/P1 Ready / live HUD / Approve kept. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Shared empty states for no campaign, empty queue, sheet, search, review, and missing lead. Header hides the campaign selector when none exist and shows New campaign instead. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Campaign creation now requires connecting a Google Sheet first: continue with the current Sheet, link an existing spreadsheet, or create a new one with standard CRM headers. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Added Refactoring UI as project skill `.cursor/skills/ui-ux/` plus a client-file Cursor rule so operator UI work loads hierarchy, spacing, type, and empty-state guidance. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Rebuilt operator UI from Refactoring UI: HSL 100–900 palette, type/space/elevation tokens, one 8px radius, action pyramid, empty-state-first, fewer borders. Screenshots used to fix translucent sticky header, modal height, and competing primaries. Typecheck + 137 Vitest + 6 Playwright. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Dropped custom CSS utilities (`.kicker`, `.choice`, `.hud`, …). Operator UI now uses Tailwind + HeroUI class names; Sheet connect options stack title above description with `flex-col gap-2`. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Eligible Sheet rows are the campaign queue (assign-leads UI/API removed). Navbar is one 56px bar: wordmark, campaign name, problem status, New campaign. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Each campaign owns a unique spreadsheet (no sharing). Create/link binds a pending Sheet to the new campaign; selecting a campaign switches the adapter. Typecheck + 138 Vitest + 6 Playwright. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Operator whitespace pass: roomier next-up/lead-detail/diagnostics, named queue diagnostics, page spinner instead of a loading card, and a fade-in call brief. | Slice 6 code complete; live smoke still blocked |
| 2026-09-12 | Dropped redundant labels (kickers, Opening, Ask first, Your call brief, Ready to call). Phone/role/company/quotes/issues use muted icons instead of em-dash copy. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Operator canvas is full-bleed: next-up card stays a readable rail, queue/brief/diagnostics fill the remaining width in a two-column split. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Independent column scroll: Call stays on screen, queue/brief scroll in a viewport-tall pane. Compact stacked layout for phones. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Route changes start at the top; Call focus no longer yanks the pane. Lead detail drops the extra Back to ready link in favor of breadcrumbs. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Lead brief is one card: regenerate lives in the header, Prep label and the duplicate Questions list are gone. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Live call uses the same light theme as Ready/review: prep, transcript, and cue sit in a three-pane calling layout. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Contained long openings on the next-up card and themed thin scrollbars (`tailwind-scrollbar`) to match the HSL tokens. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Daily summary moved to `/analytics` with date and campaign filters; Ready queue no longer shows the stats strip. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Campaign selector uses HeroUI Select/ListBox with theme tokens instead of the native OS menu. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Nested breadcrumbs now start with Home (route still `/leads`); e2e breadcrumb clicks updated. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Home Skip no longer opens lead detail (`useLeadCall` stays on `/leads`). Split no longer uses `h-full` against the page header; the leads table wrapper scrolls in the right pane (document scroll on mobile). | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Pending CRM review moved off Home to `/notifications` (nav + empty state + Open review). Ready queue no longer shows the review-waiting banner. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Lead detail no longer shows Skip or the Context enrichment block; Home next-up card still has Skip. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Replaced the static Review CRM form with an assistant-ui review chat. Opening turn summarizes the stored proposal (quotes + current vs proposed); tools call existing approve/retry/skip/write. Playwright operator journey clicks Write to Sheet & next. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Rebranded operator UI to Mantis: logo favicon/app icon, PRODUCT_NAME, green accent scale from the mark (dark-on-neon primary, not blue). Repo/package names unchanged. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Knocked the black field out of the Mantis favicon/app icons so only the green mark remains on alpha. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Next-up mint opening grows with wrapped text (no max-height / inner scrollbar). Card pane can still scroll; Call/Skip/Refresh stay pinned. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Route boot skeletons match destination layout (Home queue, lead brief, analytics stats, notification rows, diagnostics cards, review chat, login form). Home keeps “Loading leads…”. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Home polish: dropped selling-line header, eligible count, and queue borders; search/filters are one supporting toolbar (quiet at rest). Next-up + Call stay primary. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Moved Edit offering out of the Home queue toolbar to sit beside the header campaign name so it reads as offering chrome, not a filter. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Review chat is thread + composer only: removed Write to Sheet & next / Retry / Skip / Discard page buttons. Operator confirms via in-thread “Write this update” (or typed equivalent); that turn still calls approveProposal. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Merged queue diagnostics into Notifications: one header link and badge (reviews + skipped Sheet rows). `/diagnostics` redirects to `/notifications#queue`; Home “need a phone fix” deep-links there. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Tightened Mantis favicon/app icons so the mark fills the canvas; header wordmark Link shows the same 20px icon in a 24px frame. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Home search focus ring is inset (no outline-offset) and the queue toolbar has 4px padding so SPLIT_PANE overflow no longer clips it. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Removed breadcrumbs from lead detail, analytics, notifications, and review. Navbar Mantis is the Home path; no nested crumb trails remain. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Redesigned Notifications (reviews vs queue, name-first cards, full-width issue list) and Analytics (quiet header + date cluster, hero counts, grouped daily bands). Still a ledger summary, no charts. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Header/analytics campaign Select: reserved chevron slot (pe-7) and ellipsis on the value so long names no longer collide with the indicator. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Boot/page skeletons now share each route’s real geometry (Home split, lead brief, analytics filters+stats, notification list, review thread, login card). No breadcrumb chrome; Home copy stays “Loading leads…”. Live PSTN still gated. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Review chat fills the main canvas (workspace lock + docked composer). Assistant is unboxed text; user is a quiet bubble; “Write this update” stays an in-thread chip. Skeleton matches the same column and pin. Footer Approve/Write/Retry/Skip still gone. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Next-up mint + lead-detail AI prospect brief lock to pane height while loading (`overflow-hidden`, skeleton fills). Loaded quote still grows without an inner scrollbar; long briefs scroll the card body so Call/Skip/Refresh stay pinned. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Operator navbar: Notifications and Analytics are icon-only (bell / chart) with aria-label + title; New campaign is the solid primary with a plus. Badge and Campaign / Edit offering names unchanged. Live PSTN still gated. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Campaign list tick no longer collides with long names: option label ellipsizes; HeroUI absolute indicator forced into a shrink-0 in-flow slot. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Book skills moved under each eve agent (`skills/`); loader preloads cheatsheets only. System prompts rewritten. Pre-call brief is a short scan card. Typecheck + Vitest. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | GitHub Actions SSH deploy: `scripts/deploy-production.sh`, VM bootstrap `scripts/install-github-actions-ssh.sh`, workflow `.github/workflows/deploy.yml`. Auto-deploy is blocked until Azure SSH secrets exist and the VM can `git fetch origin main`. | Slice 6 code complete; live smoke still blocked; Azure auto-deploy pending secrets |
| 2026-09-13 | Azure VM installer run; `AZURE_HOST` / `AZURE_USER` / `AZURE_SSH_KEY` set. Preserved nginx/systemd templates and `HOST` bind so production stays on loopback behind nginx. First Actions deploy pending. | Slice 6 code complete; live smoke still blocked; Azure auto-deploy pending first green run |
| 2026-09-13 | First GitHub Actions production deploy succeeded (`b93d418` on VM `/opt/sales-engine/current`, `/health/live` and `/health/ready` ok). Pushes to `main` now auto-deploy. | Slice 6 code complete; live smoke still blocked; Azure auto-deploy live |
| 2026-09-13 | After Hang Up, review opens with `window.open(..., "_blank", "noopener,noreferrer")` from the click (not after finalize). Operator stays on Home/lead detail. Review page polls until the proposal exists. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Per-route `document.title` via `usePageTitle` (`Ready · Mantis`, `{name} · Mantis`, `Review · {name} · Mantis`, Analytics/Notifications/Sign in). Campaign drawer is not a route. Slice 6 still blocked on live smoke. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Lead-detail AI prospect brief uses a Cursor-like working state (writing lines, caret, staged Say/Ask/push-back/Leave sections) for first generate and regenerate. Card stays `h-full`/`overflow-hidden`; 320ms crossfade; reduced-motion falls back to a calm pulse. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Home leads table infinite-scrolls via GET `/api/leads` (`limit` default 40, `cursor` offset, `q` / `dialable` / `sort` / `dir`). Search, Ready filter, and sort reset to page 1. Next-up card is not paginated. Typecheck + 157 Vitest + table e2e. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Reverted the flashy brief working state. Lead-detail generate/regenerate is a quiet full-height pulse skeleton (instant swap, no caret/sweep/staged sections). Card still locks `h-full`/`overflow-hidden`. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Brief loading is only the white card chrome pulsing (`brief-card-pulse`). No mint bars, researching copy, or staged sections. Same surface for generate and regenerate. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Mint quote is opener-only: Company/Prospect sit-up facts moved out of `ProspectBrief` accent-soft block into the 2-col brief body. Home next-up quote was already opener-only. | Slice 6 code complete; live smoke still blocked |
| 2026-09-13 | Slice 7: append-only coach feed + composer, operator Google Calendar OAuth with Approve-only send, shared CalendarEventCard on live coach and call-review. Typecheck + 162 Vitest + 7 Playwright (Calendar fakes). Unattended auto-send still forbidden. Slice 6 live PSTN smoke remains a holdout. | Slice 7 code complete; Slice 6 live smoke still blocked |
| 2026-09-13 | Operator Settings page at `/settings` (Calendar connect/disconnect, campaign Sheet status, Twilio device, AI/Deepgram/research). Navbar Calendar OAuth control replaced with a Settings icon. OAuth callback lands on Settings. Slice 6 live PSTN smoke unchanged. | Slice 7 code complete; Slice 6 live smoke still blocked |
| 2026-09-15 | Calendar intents: meeting invites vs operator-only callback/reminder (`sendUpdates: none`). Optional morning-of `calendarReminder`. Local OAuth client in `.env` (not committed). Approve-only send unchanged. | Slice 7 calendar intents; Slice 6 live smoke still blocked |
| 2026-09-15 | Restored in-app auth: email/password accounts in SQLite, `/login` + `/signup`, session cookie gate. No Google login or Supabase. Calendar OAuth remains Settings-only. | Slice 7 complete; operator auth restored; Slice 6 live smoke still blocked |
| 2026-09-15 | Production Calendar: OAuth keys in shared `.env`, nginx callback bypass (no basic auth), VM origin → `shiv-eshwar/Mantis`. `/health/ready` calendar connected; refresh token stored. | Slice 7 complete; production Calendar connected; Slice 6 live smoke still blocked |
| 2026-09-15 | Auth pages: quiet same-hue mint wash behind Sign in / Create account (AuthShell + boot skeleton). Reduced-motion freezes the blobs. | Slice 7 complete; operator auth polish; Slice 6 live smoke still blocked |
| 2026-09-15 | Light/dark theme: evergreen dark (not navy invert), mint accent kept, header/auth/Settings/live-call toggle, preference persisted. | Slice 7 complete; operator theme; Slice 6 live smoke still blocked |
| 2026-09-15 | Verified auth + theme: logout Set-Cookie now matches Secure/SameSite so HTTPS sign-out clears the session; unknown-email login still runs scrypt; 390px header stays in-viewport (logo + New campaign icon-only). Typecheck + 195 Vitest + 8 Playwright. | Slice 7 complete; operator auth + theme; Slice 6 live smoke still blocked |
| 2026-09-15 | Home is one call queue (Sheet order, Up next Call/Skip, no left card). Every hang-up — Hang Up or remote completed — navigates to `/calls/:id/review` in this tab; write/discard returns to `/leads`. Typecheck + 196 Vitest + 9 Playwright. | Slice 7 complete; Home queue + same-tab review; Slice 6 live smoke still blocked |
| 2026-09-15 | Last-call context: stamp `call_sessions` with the logged-in operator; show last dial vs last conversation on Up next and lead detail; feed lastTouch into prospect-research and live coach. No Last Caller Sheet column, no team queues. Typecheck + 202 Vitest + 9 Playwright. | Slice 7 complete; last-call context; Slice 6 live smoke still blocked |
| 2026-09-16 | Optional Dial pad in the header: server-validated custom E.164, same live HUD, no Sheet write, hang-up returns Home. Queue Call path unchanged. Typecheck + 203 Vitest + 10 Playwright. | Slice 7 complete; optional custom dial; Slice 6 live smoke still blocked |
