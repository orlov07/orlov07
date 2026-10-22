/// <reference lib="webworker" />
import cvReady from "@techstark/opencv-js";

type Point = { x: number; y: number };
type Request = { type: "frame"; bitmap: ImageBitmap; width: number; height: number; target: { h: number; s: number; v: number }; sensitivity: number; predicted?: Point } | { type: "reset" };

let previousGray: InstanceType<(Awaited<typeof cvReady>)["Mat"]> | null = null;
type BackgroundSubtractor = { apply(src: unknown, dst: unknown, learningRate?: number): void; delete(): void };
let background: BackgroundSubtractor | null = null;
let lastPoint: Point | null = null;
let processing = false;

const release = (items: Array<{ delete(): void } | null | undefined>) => items.forEach(item => { try { item?.delete(); } catch { /* already released */ } });

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "reset") {
    release([previousGray, background]); previousGray = null; background = null; lastPoint = null; return;
  }
  if (processing) { event.data.bitmap.close(); return; }
  processing = true;
  const started = performance.now();
  const { bitmap, width, height, target, sensitivity, predicted } = event.data;
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) { bitmap.close(); processing = false; return; }
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const image = context.getImageData(0, 0, width, height);
  const cv = await cvReady;
  let src, hsv, gray, colorMask, motion, backgroundMask, combined, hierarchy, contours, kernel, low, high;
  try {
    src = cv.matFromImageData(image); hsv = new cv.Mat(); gray = new cv.Mat(); colorMask = new cv.Mat(); motion = new cv.Mat(); backgroundMask = new cv.Mat(); combined = new cv.Mat(); hierarchy = new cv.Mat(); contours = new cv.MatVector();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB); cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const hueRange = 8 + Math.round(sensitivity * 16), saturationFloor = Math.max(35, target.s - 55 - sensitivity * 70), valueFloor = Math.max(35, target.v - 65 - sensitivity * 80);
    low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.max(0, target.h - hueRange), saturationFloor, valueFloor, 0]);
    high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.min(179, target.h + hueRange), 255, 255, 255]);
    cv.inRange(hsv, low, high, colorMask);
    if (previousGray) { cv.absdiff(gray, previousGray, motion); cv.threshold(motion, motion, 12 + (1 - sensitivity) * 22, 255, cv.THRESH_BINARY); } else motion = cv.Mat.ones(height, width, cv.CV_8U); // first frame uses color only
    const cvWithVideo = cv as typeof cv & { createBackgroundSubtractorMOG2(history: number, threshold: number, shadows: boolean): BackgroundSubtractor };
    background ??= cvWithVideo.createBackgroundSubtractorMOG2(180, 18, false);
    background.apply(gray, backgroundMask, .012); cv.threshold(backgroundMask, backgroundMask, 200, 255, cv.THRESH_BINARY);
    cv.bitwise_or(motion, backgroundMask, motion); cv.bitwise_and(colorMask, motion, combined);
    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    cv.morphologyEx(combined, combined, cv.MORPH_OPEN, kernel); cv.morphologyEx(combined, combined, cv.MORPH_CLOSE, kernel);
    cv.findContours(combined, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let flowPoint: Point | null = null, flowQuality = 0;
    if (previousGray && lastPoint) {
      const oldPoints = cv.matFromArray(1, 1, cv.CV_32FC2, [lastPoint.x * width, lastPoint.y * height]);
      const newPoints = new cv.Mat(), status = new cv.Mat(), error = new cv.Mat();
      cv.calcOpticalFlowPyrLK(previousGray, gray, oldPoints, newPoints, status, error, new cv.Size(15, 15), 2);
      if (status.data[0]) { flowPoint = { x: newPoints.data32F[0]! / width, y: newPoints.data32F[1]! / height }; flowQuality = Math.max(0, 1 - error.data32F[0]! / 40); }
      release([oldPoints, newPoints, status, error]);
    }
    const candidates: Array<{ position: Point; radius: number; colorScore: number; geometryScore: number; motionScore: number; quality: number }> = [];
    const frameArea = width * height;
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index); const area = cv.contourArea(contour); const perimeter = cv.arcLength(contour, true); const rect = cv.boundingRect(contour);
      if (area < 2 || area > frameArea * .006 || perimeter <= 0) { contour.delete(); continue; }
      const center = { x: (rect.x + rect.width / 2) / width, y: (rect.y + rect.height / 2) / height };
      const circularity = Math.min(1, 4 * Math.PI * area / (perimeter * perimeter)); const aspect = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
      const expected = predicted ?? flowPoint; const temporal = expected ? Math.max(0, 1 - Math.hypot(center.x - expected.x, center.y - expected.y) / .24) : .65;
      const geometryScore = Math.max(0, Math.min(1, circularity * .65 + aspect * .35));
      candidates.push({ position: center, radius: Math.sqrt(area / Math.PI) / Math.max(width, height), colorScore: .88, geometryScore, motionScore: flowPoint ? Math.max(flowQuality, temporal) : temporal, quality: Math.max(0, Math.min(1, geometryScore * .45 + temporal * .35 + Math.min(1, area / 18) * .2)) });
      contour.delete();
    }
    candidates.sort((a, b) => b.quality - a.quality);
    if (candidates[0]) lastPoint = candidates[0].position;
    release([previousGray]); previousGray = gray.clone();
    self.postMessage({ type: "result", candidates: candidates.slice(0, 8), processingMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Falha no OpenCV.js" });
  } finally {
    release([src, hsv, gray, colorMask, motion, backgroundMask, combined, hierarchy, contours, kernel, low, high]); processing = false;
  }
};

export {};
