import { Device, type Call } from "@twilio/voice-sdk";
import { fetchVoiceToken, type DeviceStatus } from "../state/calls";

let device: Device | null = null;
let activeCall: Call | null = null;

export function getActiveTwilioCall(): Call | null {
  return activeCall;
}

export async function startTwilioDevice(onStatus: (status: DeviceStatus, detail: string) => void): Promise<void> {
  await stopTwilioDevice();
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
  if (device) {
    device.destroy();
    device = null;
  }
}

export async function connectTwilioCall(sessionId: string): Promise<Call> {
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
