# AI Call Operator

Single-user internal browser tool for outbound calling. Google Sheets is the CRM. The operator clicks Call; Twilio Voice SDK places the PSTN call; Deepgram transcribes both sides; one live coaching cue is shown at a time; after hang-up the operator reviews a proposed Sheet update and clicks Approve & next.

This is not a CRM, not a multi-agent dialer, not an auto-dialer, and not a compliance product. See **Non-goals** below.

## Non-goals

The application does **not**:

- Auto-dial, power-dial, or parallel-dial
- Send email, SMS, LinkedIn, or calendar invites
- Train or fine-tune models
- Replace Google Sheets or Gumloop
- Provide a multi-user dashboard, analytics suite, or public SaaS UI
- Guarantee recording-consent or TCPA/GDPR legal compliance
- Write transcripts or coaching text into the Sheet
- Write Gumloop-owned columns

## Architecture

```
Browser (React)  --session cookie-->  Fastify (Node 22)
       |                                    |
       | Twilio Voice SDK                   | TwiML + status + recording webhooks
       |                                    | Media Streams WS -> Deepgram (caller + contact)
       v                                    | Live coach LLM (structured JSON)
   PSTN via Twilio                          | SQLite ledger (sessions, utterances, proposals)
                                            v
                                     Google Sheets (CRM)
                                     Gumloop owns source/enrichment columns
                                     This app owns call-outcome columns only
```

Production is **one process**: `npm start` serves the API, webhooks, WebSockets, and the Vite-built client from `dist/client`.

## Local prerequisites

- Node.js 22+
- npm
- A Chromium-based desktop browser for live calling (Playwright E2E uses a fake Twilio device and does not need a microphone)
- For live PSTN: Twilio account, Deepgram key, LLM endpoint, Google service account, a public `APP_BASE_URL` (tunnel), and a Sheet shared with the service account

Copy `.env.example` to `.env` and fill values locally. Never commit `.env` or service-account JSON.

```bash
cp .env.example .env
npm install
npm run hash-password -- "your-password"
# paste the scrypt hash into APP_PASSWORD_HASH
```

Set `SESSION_SECRET` to at least 32 random characters.

## Twilio (TwiML app + number)

1. Create an API key; set `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, and `TWILIO_AUTH_TOKEN`.
2. Create a TwiML Application whose Voice Request URL is `https://<APP_BASE_URL>/twilio/voice/outbound` (HTTP POST). Set `TWILIO_TWIML_APP_SID`.
3. Buy or use a number as `TWILIO_CALLER_ID` (E.164). Point the number’s voice webhook at the same TwiML app if you use it for outbound caller ID.
4. Status callbacks used by the app: `/twilio/voice/status`, `/twilio/voice/number-status`, `/twilio/recording/status`. All HTTP webhooks require a valid `X-Twilio-Signature`.
5. Restrict destinations with `TWILIO_ALLOWED_COUNTRIES` (comma-separated ISO country codes, default `US`).

The browser obtains a short-lived Voice access token from `POST /api/twilio/token` and calls `device.connect({ sessionId })`. The server, not the client, chooses the destination number from the Sheet row.

## Deepgram

Set `DEEPGRAM_API_KEY`. Optional: `DEEPGRAM_MODEL` (default `nova-3`), `DEEPGRAM_LANGUAGE` (default `en`).

Twilio Media Streams send both tracks to `WS /twilio/media` with a short-lived `streamToken`. Default mapping until live smoke confirms it:

- `TWILIO_TRACK_CALLER=inbound` → caller
- `TWILIO_TRACK_CONTACT=outbound` → contact

If labels are reversed on a real call, swap those two env values and document the proven mapping in `VERIFICATION.md`.

Without a Deepgram key, the call continues and the UI shows transcription interrupted.

## Google service account and Sheet share

1. Create a Google Cloud service account with Sheets API enabled.
2. Share the spreadsheet with the service account email (Editor).
3. Base64-encode the JSON key file and set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
4. Set `SHEETS_BACKEND=google` and `SHEETS_CONFIG_PATH` to your mapping YAML (start from `config/sheets.example.yaml`, copy to `config/sheets.yaml` locally; do not commit real spreadsheet IDs if you treat them as sensitive).

`SHEETS_BACKEND=memory` uses an in-process fixture for local UI and tests. `none` leaves Sheets unconfigured (Call disabled).

## Sheet config mapping

`config/sheets.yaml` (or the path in `SHEETS_CONFIG_PATH`) maps **header names**, never column letters:

- `identity_column` / `read_columns.lead_id` — stable Lead ID
- Read: name, phone, company, role, enrichment, campaign, CRM status
- Write: call status/attempts/timestamps, outcome, qualification, objections, next step, summary, Twilio/recording SIDs
- `eligible_when` — which status values enter the queue
- `ownership.gumloop_owned` vs `ownership.application_owned` — disjoint; the app refuses writes to Gumloop columns

Startup preflight requires every configured header to exist exactly once. Invalid schema is a **blocking** error: Call is hidden until the Sheet is fixed. The adapter never writes during preflight.

## LLM

Set `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` for an OpenAI-compatible chat-completions endpoint. Live coaching and post-call extraction use structured JSON only. Invalid JSON, oversized cues, unknown criteria, and invented claims are dropped; the call continues. If LLM env is unset, calling still works without cues.

## Tunnel / `APP_BASE_URL`

Twilio must reach your host. For local live calls:

1. Start the app (`npm run build && npm start`, or `npm run dev` plus a tunnel to the Fastify port).
2. Point `APP_BASE_URL` at the **public HTTPS origin** Twilio uses (no trailing slash issues: the app strips a trailing slash).
3. Signature verification uses `APP_BASE_URL` + webhook path. If signatures fail, the public URL does not match what Twilio POSTs.

Production `npm start` listens on `PORT` (default 3000) and serves the SPA. `npm run dev` runs Vite on 5173 (proxies `/api`, `/health`, `/twilio`) and Fastify on 3000; set `APP_BASE_URL` to the public URL that reaches Fastify for webhooks, not the Vite origin.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local UI + API (Vite + `tsx watch`) |
| `npm test` | Vitest unit/integration tests (fakes only; no paid APIs, no browser) |
| `npm run test:e2e` | `VITE_E2E=true` client build + Playwright against faked Twilio/Deepgram/LLM/Sheets |
| `npm run build` | Vite production client into `dist/client` |
| `npm start` | `NODE_ENV=production` Fastify serving API + `dist/client` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run hash-password` | Generate `APP_PASSWORD_HASH` |

Migrations in `migrations/` run automatically on process start. SQLite defaults to `DATABASE_PATH=./data/ledger.sqlite` (WAL mode).

First Playwright run on a machine:

```bash
npx playwright install chromium
npm run test:e2e
```

## Docker

One image, one process. Persist SQLite on a volume. `--env-file .env` can override `DATABASE_PATH`; set it to the volume path so data survives restarts.

```bash
docker build -t sales-engine .
docker run --env-file .env -e DATABASE_PATH=/app/data/ledger.sqlite -p 3000:3000 -v sales-engine-data:/app/data sales-engine
```

## SQLite backup and recovery

The ledger holds sessions, utterances, coaching events, and review proposals. It is not a CRM backup of Google Sheets.

**Backup** (app can be running; WAL checkpoint is safest with the app stopped):

```bash
sqlite3 ./data/ledger.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"
cp ./data/ledger.sqlite ./data/ledger-backup-$(date +%Y%m%d).sqlite
```

**Restore:** stop the process, replace `ledger.sqlite` (and remove stale `-wal`/`-shm` if you restore a consistent copy), restart. After restore, compare Sheet rows before approving any `pending_retry` proposal.

Default Docker volume path is `/app/data/ledger.sqlite`.

## Troubleshooting

**Microphone.** Live Twilio calling needs a real mic and browser permission. Playwright E2E does not. If device.register succeeds but you hear nothing, check OS input device and that another app does not hold exclusive access.

**Twilio device offline/error.** Confirm Voice credentials, TwiML app SID, and that `POST /api/twilio/token` returns 200 while logged in. Browser console errors from `@twilio/voice-sdk` usually mean a bad token or blocked WebRTC.

**Webhook signature 403.** `APP_BASE_URL` must be exactly the origin Twilio uses (scheme + host + port). A tunnel that rewrites HTTP/HTTPS or a trailing-slash mismatch will fail `X-Twilio-Signature`.

**Speaker mapping.** Defaults are inbound → caller, outbound → contact. If the live transcript swaps sides, flip `TWILIO_TRACK_CALLER` / `TWILIO_TRACK_CONTACT` and record the proven mapping in `VERIFICATION.md`. Do not assume the default is correct on PSTN.

**Deepgram connection.** Missing key or a dropped stream shows **Transcription interrupted**. Mute and Hang Up stay available. The proposal marks the transcript incomplete. Check `DEEPGRAM_API_KEY` and that Media Streams can reach `/twilio/media`.

**Sheet schema.** Missing or duplicate headers block Call with an actionable error. Fix the Sheet header row to match `config/sheets.yaml`; do not invent column letters in code. Refresh after fixing.

## Privacy and recording

Recording and transcription may be active. The UI shows `RECORDING_NOTICE`. Give any required notice before substantive conversation. This application **does not** determine legality of recording in your jurisdiction and **does not** store credentialed Twilio media URLs—only Recording SIDs. Transcripts stay in SQLite, not in Sheets. Do not commit call recordings, transcripts, or real lead PII.

---

## Operator runbook

### 1. Before a calling session

- `/health/live` returns ok; `/health/ready` shows Sheet schema valid, campaigns loaded, and Twilio configured.
- Ready page: campaign selected, next lead dialable, Twilio device **registered**, Sheet status not `error` / `unconfigured`.
- Confirm `APP_BASE_URL` and the TwiML app still match the running host.
- Confirm you are not in a drain/restart (new Call would 503).

### 2. Pending Sheet write

If Approve fails, the proposal stays **pending_retry** with the error. Use **Retry write** on the review screen. Do not re-run extraction unless you intend to. The ledger records one application-level batch; a successful retry applies once and read-back verifies cells. If the lead’s phone or Lead ID changed on the row, you will get `identity_conflict`—fix the Sheet identity, do not guess another row.

### 3. Transcription degradation

If the UI shows **Transcription interrupted**, keep talking or hang up; do not assume missing evidence. Cues hide while health is interrupted. After the call, the proposal should show an incomplete transcript and lower-confidence / incomplete outcomes. Fix Deepgram/network before the next session.

### 4. Do not contact

If the contact asks not to be called, the coach shows a warning to acknowledge and end. On review, DNC is visually prominent. Approving writes a suppression status (`Do Not Contact`). That lead must not return to the eligible queue. Do not Skip as a substitute for DNC if they asked to be suppressed.

### 5. Campaign YAML changes

Edit files under `CAMPAIGNS_DIR` (example files in `config/campaigns/`). Restart the Node process to load changes—YAML is not hot-reloaded. Invalid campaign files fail startup. Research/networking campaigns must not declare sales-close outcomes such as `meeting_booked`. Keep `approved_claims` honest; the coach validator rejects invented proof.

### 6. Ownership disjointness

Gumloop-owned headers (IDs, name, phone, enrichment, CRM status, etc.) must not appear in `application_owned`. The write path allowlists application columns only. If Gumloop edits enrichment mid-call, Approve still must leave those cells untouched. If you add a Sheet column, assign it to exactly one owner in YAML and re-run preflight.

## Verification

See [`VERIFICATION.md`](./VERIFICATION.md) for the acceptance matrix, holdouts H1–H14, and the live PSTN smoke checklist (live smoke is credential-gated and is not implied by `npm test`).
