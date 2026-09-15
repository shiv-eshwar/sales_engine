import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: vi.fn(), hang: false, instances: [] as any[] }));
vi.mock("../../src/client/state/calls", () => ({ fetchVoiceToken: mocks.token }));
vi.mock("@twilio/voice-sdk", async () => {
  const { EventEmitter } = await import("node:events");
  class Device extends EventEmitter {
    static State = { Registered: "registered" };
    state = "unregistered";
    isBusy = false;
    destroy = vi.fn(() => { this.state = "destroyed"; this.emit("unregistered"); });
    updateToken = vi.fn();
    register = vi.fn(async () => { if (mocks.hang) { this.state = "registering"; await new Promise(() => {}); } this.state = "registered"; this.emit("registered"); });
    constructor() { super(); mocks.instances.push(this); }
  }
  return { Device };
});
import { startTwilioDevice, stopTwilioDevice } from "../../src/client/twilio/device";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.instances.length = 0;
  mocks.hang = false;
  mocks.token.mockReset().mockResolvedValue("test-token");
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(async () => { await stopTwilioDevice(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("voice registration recovery", () => {
  it("retries a failed token request and reaches registered", async () => {
    mocks.token.mockRejectedValueOnce(new Error("temporary outage"));
    const status = vi.fn();
    await startTwilioDevice(status);
    expect(status).toHaveBeenLastCalledWith("error", expect.stringContaining("temporary outage"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(status).toHaveBeenLastCalledWith("registered", "Voice ready");
  });
  it("recovers an unregistered device", async () => {
    const status = vi.fn();
    await startTwilioDevice(status);
    const old = mocks.instances[0];
    old.state = "unregistered"; old.emit("unregistered");
    await vi.advanceTimersByTimeAsync(2000);
    expect(old.destroy).toHaveBeenCalledOnce();
    expect(mocks.instances).toHaveLength(2);
    expect(status).toHaveBeenLastCalledWith("registered", "Voice ready");
  });
  it("retries token refresh without destroying an active device", async () => {
    const status = vi.fn();
    await startTwilioDevice(status);
    const d = mocks.instances[0]; d.isBusy = true;
    mocks.token.mockRejectedValueOnce(new Error("refresh unavailable"));
    d.emit("tokenWillExpire");
    await vi.advanceTimersByTimeAsync(5000);
    expect(d.updateToken).toHaveBeenCalledWith("test-token");
    expect(d.destroy).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("registered", "Voice ready");
  });
  it("does not create a device after a stopped start finishes fetching", async () => {
    let resolve!: (value: string) => void;
    mocks.token.mockReturnValueOnce(new Promise<string>(r => { resolve = r; }));
    const pending = startTwilioDevice(vi.fn());
    await stopTwilioDevice();
    resolve("late-token"); await pending;
    expect(mocks.instances).toHaveLength(0);
  });
  it("recovers after a registration attempt stalls", async () => {
    mocks.hang = true;
    const status = vi.fn();
    const pending = startTwilioDevice(status);
    await vi.advanceTimersByTimeAsync(20000);
    await pending;
    expect(status).toHaveBeenLastCalledWith("error", expect.stringContaining("timed out"));
    mocks.hang = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(status).toHaveBeenLastCalledWith("registered", "Voice ready");
    expect(mocks.instances[0].destroy).toHaveBeenCalledOnce();
  });
  it("cancels scheduled recovery when stopped", async () => {
    mocks.token.mockRejectedValueOnce(new Error("offline"));
    await startTwilioDevice(vi.fn());
    await stopTwilioDevice();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.token).toHaveBeenCalledTimes(1);
  });
  it("does not replace a busy device after a registration error", async () => {
    await startTwilioDevice(vi.fn());
    const d = mocks.instances[0]; d.isBusy = true; d.state = "unregistered";
    d.emit("unregistered");
    await vi.advanceTimersByTimeAsync(10000);
    expect(d.destroy).not.toHaveBeenCalled();
  });
});
