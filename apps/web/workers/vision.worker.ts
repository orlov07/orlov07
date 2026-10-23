/// <reference lib="webworker" />
import cvReady from "@techstark/opencv-js";

type Point = { x: number; y: number };
type Target = { h: number; s: number; v: number };
type FrameRequest = {
  type: "frame";
  frameId: number;
  capturedAt: number;
  width: number;
  height: number;
  sensitivity: number;
  target?: Target;
  predicted?: Point;
  bitmap?: ImageBitmap;
  pixels?: ArrayBuffer;
};
type Request = FrameRequest | { type: "reset" } | { type: "ping" };
type Disposable = { delete(): void };
type BackgroundSubtractor = Disposable & { apply(src: unknown, dst: unknown, learningRate?: number): void };
type CvRuntime = Awaited<typeof cvReady> & { createBackgroundSubtractorMOG2?: (history: number, threshold: number, shadows: boolean) => BackgroundSubtractor };

let cv: CvRuntime | null = null;
let previousGray: InstanceType<(Awaited<typeof cvReady>)["Mat"]> | null = null;
let background: BackgroundSubtractor | null = null;
let lastPoint: Point | null = null;
let processing = false;
let resetRequested = false;
const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined";

const release = (...items: Array<Disposable | null | undefined>) => items.forEach(item => { try { item?.delete(); } catch { /* OpenCV object already released */ } });
const postStatus = (opencv: "loading" | "ready" | "error", message?: string) => self.postMessage({ type: "status", worker: "ready", opencv, offscreenCanvas: hasOffscreenCanvas, message });

const initialization = (async () => {
  postStatus("loading");
  try {
    cv = await cvReady as CvRuntime;
    const probe = new cv.Mat(1, 1, cv.CV_8U); probe.delete();
    postStatus("ready", cv.getBuildInformation().split("\n")[0] || "OpenCV.js pronto");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    postStatus("error", message); throw error;
  }
})();

function resetState() {
  release(previousGray, background); previousGray = null; background = null; lastPoint = null; resetRequested = false;
}

async function imageDataFromFrame(frame: FrameRequest): Promise<ImageData> {
  if (frame.pixels) return new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height);
  if (!frame.bitmap) throw new Error("Frame recebido sem bitmap ou pixels.");
  if (!hasOffscreenCanvas) { frame.bitmap.close(); throw new Error("OffscreenCanvas indisponível; envie pixels como fallback."); }
  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) { frame.bitmap.close(); throw new Error("Contexto 2D indisponível no Worker."); }
  context.drawImage(frame.bitmap, 0, 0, frame.width, frame.height); frame.bitmap.close();
  return context.getImageData(0, 0, frame.width, frame.height);
}

function hueDistance(a: number, b: number) { const direct = Math.abs(a - b); return Math.min(direct, 180 - direct); }
const clamp = (value: number) => Math.max(0, Math.min(1, value));

async function processFrame(frame: FrameRequest) {
  const started = performance.now();
  await initialization;
  if (!cv) throw new Error("OpenCV.js não inicializado.");
  const image = await imageDataFromFrame(frame);
  let src, rgb, hsv, gray, colorMask, motionMask, backgroundMask, candidateMask, hierarchy, contours, kernel, low, high;
  try {
    src = cv.matFromImageData(image); rgb = new cv.Mat(); hsv = new cv.Mat(); gray = new cv.Mat(); colorMask = new cv.Mat(); motionMask = new cv.Mat(); backgroundMask = new cv.Mat(); candidateMask = new cv.Mat(); hierarchy = new cv.Mat(); contours = new cv.MatVector();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB); cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    if (previousGray) { cv.absdiff(gray, previousGray, motionMask); cv.threshold(motionMask, motionMask, 10 + (1 - frame.sensitivity) * 22, 255, cv.THRESH_BINARY); }
    else { release(motionMask); motionMask = cv.Mat.ones(frame.height, frame.width, cv.CV_8U); }

    if (!background && cv.createBackgroundSubtractorMOG2) background = cv.createBackgroundSubtractorMOG2(160, 16, false);
    if (background) { background.apply(gray, backgroundMask, .015); cv.threshold(backgroundMask, backgroundMask, 200, 255, cv.THRESH_BINARY); cv.bitwise_or(motionMask, backgroundMask, motionMask); }

    if (frame.target) {
      const hueRange = 8 + Math.round(frame.sensitivity * 16), saturationFloor = Math.max(25, frame.target.s - 55 - frame.sensitivity * 75), valueFloor = Math.max(25, frame.target.v - 65 - frame.sensitivity * 85);
      low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.max(0, frame.target.h - hueRange), saturationFloor, valueFloor, 0]);
      high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.min(179, frame.target.h + hueRange), 255, 255, 255]);
      cv.inRange(hsv, low, high, colorMask);
      cv.bitwise_and(colorMask, motionMask, candidateMask);
    } else motionMask.copyTo(candidateMask);

    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    cv.morphologyEx(candidateMask, candidateMask, cv.MORPH_OPEN, kernel); cv.morphologyEx(candidateMask, candidateMask, cv.MORPH_CLOSE, kernel);
    cv.findContours(candidateMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let flowPoint: Point | null = null, flowQuality = 0;
    if (previousGray && lastPoint) {
      const oldPoints = cv.matFromArray(1, 1, cv.CV_32FC2, [lastPoint.x * frame.width, lastPoint.y * frame.height]);
      const newPoints = new cv.Mat(), status = new cv.Mat(), flowError = new cv.Mat();
      try {
        cv.calcOpticalFlowPyrLK(previousGray, gray, oldPoints, newPoints, status, flowError, new cv.Size(15, 15), 2);
        if (status.data[0]) { flowPoint = { x: newPoints.data32F[0]! / frame.width, y: newPoints.data32F[1]! / frame.height }; flowQuality = clamp(1 - flowError.data32F[0]! / 40); }
      } finally { release(oldPoints, newPoints, status, flowError); }
    }

    const candidates: Array<{ position: Point; radius: number; colorScore: number; geometryScore: number; motionScore: number; quality: number }> = [];
    const frameArea = frame.width * frame.height;
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index); let contourMask, motionRoi;
      try {
        const area = cv.contourArea(contour), perimeter = cv.arcLength(contour, true), rect = cv.boundingRect(contour);
        if (area < 2 || area > frameArea * .012 || perimeter <= 0 || rect.width < 1 || rect.height < 1) continue;
        const center = { x: (rect.x + rect.width / 2) / frame.width, y: (rect.y + rect.height / 2) / frame.height };
        const circularity = clamp(4 * Math.PI * area / (perimeter * perimeter)), aspect = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
        const fill = clamp(area / (rect.width * rect.height)), geometryScore = clamp(circularity * .5 + aspect * .3 + fill * .2);
        contourMask = cv.Mat.zeros(frame.height, frame.width, cv.CV_8U); const oneContour = new cv.MatVector(); oneContour.push_back(contour); cv.drawContours(contourMask, oneContour, 0, new cv.Scalar(255), -1); oneContour.delete();
        motionRoi = candidateMask.roi(rect);
        const meanHsv = cv.mean(hsv, contourMask), movingPixels = cv.countNonZero(motionRoi);
        const expected = frame.predicted ?? flowPoint, temporal = expected ? clamp(1 - Math.hypot(center.x - expected.x, center.y - expected.y) / .24) : .55;
        const motionScore = clamp((movingPixels / Math.max(1, rect.width * rect.height)) * .65 + (flowPoint ? Math.max(flowQuality, temporal) : temporal) * .35);
        const colorScore = frame.target ? clamp((1 - hueDistance(meanHsv[0]!, frame.target.h) / 35) * .55 + Math.min(meanHsv[1]! / Math.max(80, frame.target.s), 1) * .25 + (1 - Math.abs(meanHsv[2]! - frame.target.v) / 255) * .2) : 0;
        const sizeScore = clamp(area / 12) * clamp(1 - area / (frameArea * .012));
        const quality = clamp(geometryScore * .32 + motionScore * .28 + colorScore * .28 + sizeScore * .12);
        candidates.push({ position: center, radius: Math.sqrt(area / Math.PI) / Math.max(frame.width, frame.height), colorScore, geometryScore, motionScore, quality });
      } finally { release(motionRoi, contourMask, contour); }
    }
    candidates.sort((a, b) => b.quality - a.quality); if (candidates[0]) lastPoint = candidates[0].position;
    release(previousGray); previousGray = gray.clone();
    self.postMessage({ type: "result", frameId: frame.frameId, capturedAt: frame.capturedAt, candidates: candidates.slice(0, 12), candidateCount: candidates.length, processingMs: performance.now() - started, calibrated: Boolean(frame.target) });
  } finally {
    release(src, rgb, hsv, gray, colorMask, motionMask, backgroundMask, candidateMask, hierarchy, contours, kernel, low, high);
    if (resetRequested) resetState();
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "ping") { await initialization; self.postMessage({ type: "pong", at: performance.now() }); return; }
  if (event.data.type === "reset") { if (processing) resetRequested = true; else resetState(); return; }
  if (processing) { event.data.bitmap?.close(); self.postMessage({ type: "dropped", frameId: event.data.frameId, reason: "busy" }); return; }
  processing = true;
  try { await processFrame(event.data); }
  catch (error) { event.data.bitmap?.close(); self.postMessage({ type: "error", frameId: event.data.frameId, fatal: false, message: error instanceof Error ? error.message : String(error) }); }
  finally { processing = false; }
};

self.postMessage({ type: "status", worker: "ready", opencv: "loading", offscreenCanvas: hasOffscreenCanvas });
export {};
