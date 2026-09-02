# Verification

Last automated run: 2026-09-02.

**Commit under test:** `e03c2c8` (`Add Slice 6 verification: holdouts, Playwright E2E, drain, and docs.`).

No real lead PII, recordings, or provider credentials are copied here.

## Commands and last local results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm test` (Vitest) | 18 files, **74 passed** |
| `npx playwright install chromium` (once per machine) | Installed |
| `npm run test:e2e` | Vite `VITE_E2E=true` build + Playwright **3 passed** (login→approve, Deepgram drop, invalid Sheet schema) |
| `docker build -t sales-engine .` | Pass (image `sales-engine:latest`) |
| `NODE_ENV=production` `GET /health/live` | `{"status":"ok"}` |
| `NODE_ENV=production` `GET /health/ready` | `status: ok`; Sheet memory schema valid; **Twilio / Deepgram / LLM not configured** |
| Live PSTN / Google Sheet / paid LLM smoke (`whatthis.md` §19) | **Not run** — `.env` has no Twilio, Deepgram, LLM, or Google Sheets credentials |

Default `npm test` does not start a browser and does not call paid APIs. Fakes cover Twilio webhooks/media, Deepgram, LLM, and an in-memory Sheet.

## §22 acceptance matrix

| Criterion | Evidence | Status |
|---|---|---|
| One command starts local development after configuration | `npm run dev` in README | Documented (not live-run in this pass) |
| One production build creates the single deployable service | `npm run build` + `npm start`; `Dockerfile` | Automated build + image recipe |
| No secrets or real call data committed | `.gitignore` for `.env`, `data/`, sqlite, credentials | Pass (working tree) |
| Sheet schema preflight is blocking and non-mutating | `tests/unit/preflight.test.ts`; E2E “invalid Sheet headers block Call” | Pass (fakes) |
| Gumloop-owned columns cannot be written | `tests/unit/ownership.test.ts`; holdout H7 | Pass (fakes) |
| Browser Twilio calling on a controlled real call | Requires Twilio + PSTN | **Live-gated** |
| Both speakers transcribed and attributed | Integration transcription tests + E2E speaker labels; **live track map unconfirmed** | Pass (fakes); live map **not run** |
| Live cues structured, short, rate-limited, evidence/claim validated | Coach unit tests; H10, H14 | Pass (fakes) |
| Qualification cannot become positive without evidence | Qualification reducer tests; H3 | Pass (fakes) |
| Objection handling starts with clarify/diagnosis | H1 | Pass (fakes) |
| Non-connected calls avoid LLM costs | H5; review non-connect tests | Pass (fakes) |
| Post-call semantic updates require review | Review integration tests; E2E review table before Approve | Pass (fakes) |
| Sheet write atomic, verified, retryable | H13; review retry tests | Pass (fakes) |
| Duplicate provider events are idempotent | H6; webhook tests | Pass (fakes) |
| DNC leads suppressed from eligibility | H4 | Pass (fakes) |
| Sales / research / networking cues are purpose-appropriate | H1, H11, H12 | Pass (fakes) |
| All holdout scenarios pass | `tests/integration/holdouts.test.ts` H1–H14 | Pass (fakes) |
| Live smoke test passes and speaker mapping documented | §19 checklist below | **Not run** |
| README and VERIFICATION complete | This file + `README.md` | Pass |

## Holdouts H1–H14

Source: `tests/integration/holdouts.test.ts`. Prompts send campaign config, not verbatim expected outcomes.

| ID | Scenario | Result |
|---|---|---|
| H1 | Qualified sales + existing-solution objection; first cue `clarify`; meeting/follow-up | Pass |
| H2 | Clear disqualification; no `meeting_booked` | Pass |
| H3 | Vague chat; qualification stays `unknown`; cue targets a missing criterion | Pass |
| H4 | “do not contact”; warning cue; approve writes DNC; lead leaves queue | Pass |
| H5 | Ringing then no-answer; `llm.calls.length === 0`; no media; one proposal | Pass |
| H6 | Duplicate status/recording; completed then delayed in-progress; one terminal session / one proposal | Pass |
| H7 | Enrichment mutated mid-call; Gumloop cell unchanged; app columns written | Pass |
| H8 | Phone changed before approve; `identity_conflict`; write count unchanged | Pass |
| H9 | Deepgram `fail()`; interrupted health; incomplete transcript / low-confidence proposal | Pass |
| H10 | Invalid JSON, oversized cue, unknown criterion, invented case study; no unsafe cue; call stays up | Pass |
| H11 | `lamina-research`; vague answer; concrete-example cue; no sales-close outcome | Pass |
| H12 | `lamina-networking`; advice-only; follow-up/reciprocity; `cueType !== "objection"` | Pass |
| H13 | `failNextWrite()` on approve → `pending_retry`; retry writes once | Pass |
| H14 | Cue invents proof absent from `approved_claims`; validator rejects | Pass |

## Playwright E2E (faked providers)

`VITE_E2E=true` replaces Twilio Voice SDK with an in-memory device. Playwright Node posts signed TwiML/status and opens `/twilio/media`.

| # | Flow | Result |
|---|---|---|
| 1 | Login → campaign → lead → Call → ringing/connected | Pass |
| 2 | Transcript speaker labels (Caller / Contact) | Pass |
| 3 | One cue card (no stack) | Pass |
| 4 | Mute / Unmute / Hang Up | Pass |
| 5 | Review field-level Sheet diff | Pass |
| 6 | Approve & next → Jordan Chen (fixture L-101) | Pass |
| 7 | Deepgram drop → “Transcription interrupted”; Mute/Hang Up enabled | Pass |
| 8 | Invalid Sheet headers → blocking error, no Call button | Pass |

## Live smoke (`whatthis.md` §19) — not run

Do this on a **user-owned** test number after credentials exist. Do not cold-call an external lead.

1. Add a test lead to a test Sheet using the production header structure.
2. Confirm `/health/ready` and Ready-page preflight.
3. Open the app in desktop Chromium.
4. Confirm Twilio device **registered** and microphone selection.
5. Call the controlled test number.
6. Speak distinct phrases from each side; record actual speaker labels vs Twilio track names.
7. Raise an `existing_solution` objection; cue should clarify/diagnose, not rebut with invented proof.
8. State qualification evidence and a fictional next step.
9. Hang up.
10. Confirm terminal status, Recording SID (not a media URL), transcript, proposal, evidence, field-level diff.
11. Approve.
12. Confirm the correct row changed, Gumloop cells unchanged, duplicate callback does not double-write.
13. Record latencies **without PII**.

### Speaker mapping (live)

| Twilio track | Mapped speaker | Confirmed on PSTN? |
|---|---|---|
| inbound (default `TWILIO_TRACK_CALLER`) | caller | **Not confirmed** |
| outbound (default `TWILIO_TRACK_CONTACT`) | contact | **Not confirmed** |

If labels are reversed, swap the two env vars and update this table.

### Latencies (live)

| Measurement | Value |
|---|---|
| Final transcript utterance → UI | *not measured* |
| Contact final → visible cue | *not measured* |
| Hang-up → review proposal ready | *not measured* |

## Known limitations

- Live Twilio/Deepgram/LLM/Sheets credentials were not used in this verification pass.
- Default audio-track mapping is assumed until §19 is executed.
- Playwright does not exercise WebRTC or a real microphone.
- SIGTERM drain is covered by `tests/integration/drain.test.ts` (503 new sessions; active session not hung up). Bounded drain timeout defaults to 30s (`DRAIN_TIMEOUT_MS`).
- Docker image `sales-engine:latest` built locally on 2026-09-02 (`docker build -t sales-engine .`).
