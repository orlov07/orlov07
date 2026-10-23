import { describe, expect, it } from "vitest";
import { adaptiveFrameInterval, preferredTransport, shouldCaptureFrame } from "./pipeline";

describe("vision pipeline", () => {
  it("captures before calibration when runtime and video are ready", () => {
    expect(shouldCaptureFrame({ workerReady: true, openCvReady: true, videoReady: true, pending: false, elapsedMs: 50, intervalMs: 42 })).toBe(true);
  });
  it("waits for runtime and applies backpressure", () => {
    expect(shouldCaptureFrame({ workerReady: false, openCvReady: true, videoReady: true, pending: false, elapsedMs: 50, intervalMs: 42 })).toBe(false);
    expect(shouldCaptureFrame({ workerReady: true, openCvReady: true, videoReady: true, pending: true, elapsedMs: 50, intervalMs: 42 })).toBe(false);
  });
  it("falls back to pixels without OffscreenCanvas or ImageBitmap", () => {
    expect(preferredTransport(true, true)).toBe("bitmap");
    expect(preferredTransport(false, true)).toBe("pixels");
    expect(preferredTransport(true, false)).toBe("pixels");
  });
  it("reduces capture rate under processing pressure", () => {
    expect(adaptiveFrameInterval(20)).toBe(42); expect(adaptiveFrameInterval(40)).toBe(67); expect(adaptiveFrameInterval(80)).toBe(100);
  });
});
