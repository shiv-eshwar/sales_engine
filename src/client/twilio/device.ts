import { Device, type Call } from "@twilio/voice-sdk";
import { fetchVoiceToken, type DeviceStatus } from "../state/calls";

let device: Device | null = null;
let activeCall: Call | null = null;
let pendingIncoming: Call | null = null;
let incomingHandler: ((call: Call) => void) | null = null;
let e2eRegistered = false;

function isE2eFake(): boolean {
  const flag = import.meta.env.VITE_E2E;
  return flag === "true" || flag === "1";
}

function fakeCallHandle(): Call {
  const handle = {
    disconnect() {
      activeCall = null;
    },
    mute(_muted?: boolean) {
      return Boolean(_muted);
    },
    sendDigits(_digits: string) {
      return;
    },
    on(_event: string, _handler: () => void) {
      return handle;
    }
  };
  return handle as unknown as Call;
}

export function getActiveTwilioCall(): Call | null {
  return activeCall;
}

let generation = 0;
let disposeRegistration: (() => void) | null = null;

export async function startTwilioDevice(onStatus: (status: DeviceStatus, detail: string) => void): Promise<void> {
  // Cleanup is synchronous even though the public API returns a promise.
  void stopTwilioDevice();
  const ownGeneration = generation;
  const current = () => generation === ownGeneration;
  if (isE2eFake()) {
    e2eRegistered = true;
    onStatus("registered", "E2E fake device");
    return;
  }
  let retry: ReturnType<typeof setTimeout> | undefined;
  let refreshRetry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let attempting = false;
  let refreshing = false;
  let failures = 0;
  let lastReport = "";
  const report = (status: DeviceStatus, detail: string, code?: number) => {
    if (!current()) return;
    onStatus(status, detail);
    const key = `${status}:${code ?? ""}`;
    if (key !== lastReport) {
      lastReport = key;
      // Only structured status/code: never send tokens or SDK error payloads.
      void fetch("/api/twilio/device-status", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, code }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
    }
  };
  const detail = (error: unknown) => {
    const e = error as { code?: number; message?: string } | null;
    const code = typeof e?.code === "number" ? e.code : undefined;
    return { code, message: `${code ? `Twilio ${code}: ` : ""}${e?.message || "Voice connection failed"}` };
  };
  const schedule = () => {
    if (!current() || retry) return;
    const delay = Math.min(30000, 2000 * 2 ** Math.min(failures++, 4));
    retry = setTimeout(() => { retry = undefined; void attempt(); }, delay);
  };
  const refresh = async (next: Device) => {
    if (!current() || device !== next || refreshing) return;
    refreshing = true;
    try {
      const token = await fetchVoiceToken();
      if (!current() || device !== next) return;
      next.updateToken(token);
      clearTimeout(refreshRetry);
      if (next.state === Device.State.Registered) report("registered", "Voice ready");
    } catch (error) {
      if (!current() || device !== next) return;
      const e = detail(error);
      report("error", `${e.message}. Retrying voice authentication…`, e.code);
      clearTimeout(refreshRetry);
      refreshRetry = setTimeout(() => { void refresh(next); }, 5000);
    } finally {
      refreshing = false;
    }
  };
  const attempt = async () => {
    if (!current() || attempting) return;
    // Never destroy a device carrying a call to recover registration.
    if (activeCall || pendingIncoming || device?.isBusy) { schedule(); return; }
    if (device?.state === Device.State.Registered) return;
    attempting = true;
    try {
      report("registering", "Connecting voice…");
      const token = await fetchVoiceToken();
      if (!current()) return;
      const previous = device;
      device = null;
      previous?.destroy();
      const next = new Device(token, { logLevel: 3, edge: "roaming", tokenRefreshMs: 60000, closeProtection: true });
      device = next;
      const valid = () => current() && device === next;
      next.on("registered", () => {
        if (!valid()) return;
        failures = 0;
        clearTimeout(retry); retry = undefined;
        report("registered", "Voice ready");
      });
      next.on("unregistered", () => {
        if (!valid()) return;
        report("offline", "Voice disconnected. Reconnecting…");
        schedule();
      });
      next.on("error", (error: unknown) => {
        if (!valid()) return;
        const e = detail(error);
        report("error", `${e.message}. Retrying automatically…`, e.code);
        if (e.code === 20101 || e.code === 20104 || e.code === 31205) void refresh(next);
        schedule();
      });
      next.on("tokenWillExpire", () => { if (valid()) void refresh(next); });
      if (incomingHandler) next.on("incoming", incomingHandler);
      await Promise.race([
        next.register(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(new Error("Voice registration timed out; check your network connection")), 20000);
        })
      ]);
    } catch (error) {
      if (!current()) return;
      const e = detail(error);
      report("error", `${e.message}. Retrying automatically…`, e.code);
      schedule();
    } finally {
      clearTimeout(deadline);
      attempting = false;
    }
  };
  const reconnect = () => {
    if (!current()) return;
    if (device) void refresh(device);
    clearTimeout(retry); retry = undefined;
    void attempt();
  };
  const visible = () => { if (document.visibilityState === "visible") reconnect(); };
  window.addEventListener("online", reconnect);
  document.addEventListener("visibilitychange", visible);
  disposeRegistration = () => {
    clearTimeout(retry);
    clearTimeout(refreshRetry);
    clearTimeout(deadline);
    window.removeEventListener("online", reconnect);
    document.removeEventListener("visibilitychange", visible);
  };
  await attempt();
}

export async function stopTwilioDevice(): Promise<void> {
  generation++;
  disposeRegistration?.();
  disposeRegistration = null;
  if (activeCall) {
    activeCall.disconnect();
    activeCall = null;
  }
  pendingIncoming = null;
  e2eRegistered = false;
  const previous = device;
  device = null;
  previous?.destroy();
}

export async function connectTwilioCall(sessionId: string): Promise<Call> {
  if (isE2eFake()) {
    if (!e2eRegistered) {
      throw new Error("Twilio device is not registered");
    }
    void sessionId;
    const call = fakeCallHandle();
    activeCall = call;
    return call;
  }
  if (!device || device.state !== Device.State.Registered) {
    throw new Error("Voice is reconnecting. Wait for Voice ready before calling.");
  }
  const call = await device.connect({ params: { sessionId } });
  activeCall = call;
  call.on("disconnect", () => {
    if (activeCall === call) {
      activeCall = null;
    }
  });
  return call;
}

export function hangUpTwilioCall(): void {
  activeCall?.disconnect();
  activeCall = null;
}

export function onTwilioIncoming(handler: (call: Call) => void): () => void {
  incomingHandler = handler;
  device?.on("incoming", handler);
  return () => {
    if (incomingHandler === handler) {
      incomingHandler = null;
    }
    device?.removeListener("incoming", handler);
  };
}

export function getPendingIncomingCall(): Call | null {
  return pendingIncoming;
}

export function setPendingIncomingCall(call: Call | null): void {
  pendingIncoming = call;
}

export function acceptTwilioIncomingCall(call: Call): void {
  if (pendingIncoming === call) {
    pendingIncoming = null;
  }
  call.accept();
  if (activeCall && activeCall !== call) {
    activeCall.disconnect();
  }
  activeCall = call;
  call.on("disconnect", () => {
    if (activeCall === call) {
      activeCall = null;
    }
  });
}

export function rejectTwilioIncomingCall(call: Call): void {
  if (pendingIncoming === call) {
    pendingIncoming = null;
  }
  call.reject();
}

export function setTwilioMuted(muted: boolean): void {
  activeCall?.mute(muted);
}

export function sendTwilioDigits(digits: string): boolean {
  if (!activeCall || typeof activeCall.sendDigits !== "function") {
    return false;
  }
  activeCall.sendDigits(digits);
  return true;
}
