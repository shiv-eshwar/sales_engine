import { GAP_TEXT, type PublicUtterance } from "../transcript/utterances.js";
import type { PlaybookConfig } from "../../shared/schemas.js";

export type TalkRatio = {
  callerShare: number;
  contactShare: number;
  callerMs: number;
  contactMs: number;
  connectedSeconds: number;
  warn: boolean;
};

function durationMs(row: PublicUtterance): number {
  return Math.max(0, row.endedAtMs - row.startedAtMs);
}

export function computeTalkRatio(
  utterances: PublicUtterance[],
  connectedAt: string | null,
  playbook: PlaybookConfig | null,
  now = Date.now()
): TalkRatio {
  let callerMs = 0;
  let contactMs = 0;
  for (const row of utterances) {
    if (row.text === GAP_TEXT) {
      continue;
    }
    const ms = durationMs(row);
    if (row.speaker === "caller") {
      callerMs += ms;
    } else {
      contactMs += ms;
    }
  }
  const total = callerMs + contactMs;
  const callerShare = total === 0 ? 0 : callerMs / total;
  const contactShare = total === 0 ? 0 : contactMs / total;
  const connectedSeconds = connectedAt ? Math.max(0, Math.floor((now - Date.parse(connectedAt)) / 1000)) : 0;
  const warnAfter = playbook?.talk_ratio.warn_after_connected_seconds ?? 60;
  const warnAbove = playbook?.talk_ratio.warn_caller_above ?? 0.4;
  return {
    callerShare,
    contactShare,
    callerMs,
    contactMs,
    connectedSeconds,
    warn: connectedSeconds >= warnAfter && callerShare > warnAbove
  };
}
