import { Device, type Call } from "@twilio/voice-sdk";
import { fetchVoiceToken, type DeviceStatus } from "../state/calls";

let device: Device | null = null;
let activeCall: Call | null = null;
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
    on(_event: string, _handler: () => void) {
      return handle;
    }
  };
  return handle as unknown as Call;
}

export function getActiveTwilioCall(): Call | null {
  return activeCall;
}

export async function startTwilioDevice(onStatus: (status: DeviceStatus, detail: string) => void): Promise<void> {
  await stopTwilioDevice();
  if (isE2eFake()) {
    onStatus("registering", "Fetching Voice token");
    e2eRegistered = true;
    onStatus("registered", "E2E fake device");
    return;
  }
  onStatus("registering", "Fetching Voice token");
  const token = await fetchVoiceToken();
  const next = new Device(token, { logLevel: 1, edge: "roaming" });
  next.on("registered", () => onStatus("registered", "Twilio device registered"));
  next.on("unregistered", () => onStatus("offline", "Twilio device offline"));
  next.on("error", (error: { message?: string }) => {
    onStatus("error", error.message ?? "Twilio device error");
  });
  next.on("tokenWillExpire", () => {
    void fetchVoiceToken().then((fresh) => next.updateToken(fresh));
  });
  next.on("disconnect", () => {
    activeCall = null;
  });
  device = next;
  await next.register();
}

export async function stopTwilioDevice(): Promise<void> {
  if (activeCall) {
    activeCall.disconnect();
    activeCall = null;
  }
  e2eRegistered = false;
  if (device) {
    device.destroy();
    device = null;
  }
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
  if (!device) {
    throw new Error("Twilio device is not registered");
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

export function setTwilioMuted(muted: boolean): void {
  activeCall?.mute(muted);
}
