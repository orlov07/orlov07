export type CaptureReadiness = {
  workerReady: boolean;
  openCvReady: boolean;
  videoReady: boolean;
  pending: boolean;
  elapsedMs: number;
  intervalMs: number;
};

// Calibration is deliberately absent: diagnostics must process frames before a ball is selected.
export function shouldCaptureFrame(state: CaptureReadiness): boolean {
  return state.workerReady && state.openCvReady && state.videoReady && !state.pending && state.elapsedMs >= state.intervalMs;
}

export function adaptiveFrameInterval(processingMs: number): number {
  if (processingMs > 55) return 100;
  if (processingMs > 30) return 67;
  return 42;
}

export function preferredTransport(offscreenCanvas: boolean, imageBitmap: boolean): "bitmap" | "pixels" {
  return offscreenCanvas && imageBitmap ? "bitmap" : "pixels";
}
