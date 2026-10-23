import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

describe("OpenCV.js runtime integration", () => {
  it("loads the real runtime and extracts a moving circular contour", async () => {
    // The package is UMD; require preserves the receiver of its thenable in Node/Vitest.
    const cv = await require("@techstark/opencv-js") as typeof import("@techstark/opencv-js");
    const previous = cv.Mat.zeros(90, 160, cv.CV_8UC1), current = cv.Mat.zeros(90, 160, cv.CV_8UC1), difference = new cv.Mat(), mask = new cv.Mat(), contours = new cv.MatVector(), hierarchy = new cv.Mat();
    try {
      cv.circle(current, new cv.Point(80, 45), 5, new cv.Scalar(255), -1);
      cv.absdiff(current, previous, difference); cv.threshold(difference, mask, 20, 255, cv.THRESH_BINARY);
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      expect(contours.size()).toBeGreaterThan(0);
      const contour = contours.get(0);
      try { expect(cv.contourArea(contour)).toBeGreaterThan(40); }
      finally { contour.delete(); }
    } finally { previous.delete(); current.delete(); difference.delete(); mask.delete(); contours.delete(); hierarchy.delete(); }
  }, 30_000);

  it("processes a sequence of frames at a measurable positive rate", async () => {
    const cv = await require("@techstark/opencv-js") as typeof import("@techstark/opencv-js");
    const started = performance.now(); let processed = 0;
    for (let frame = 0; frame < 12; frame += 1) {
      const previous = cv.Mat.zeros(90, 160, cv.CV_8UC1), current = cv.Mat.zeros(90, 160, cv.CV_8UC1), difference = new cv.Mat(), mask = new cv.Mat();
      try { cv.circle(previous, new cv.Point(20 + frame, 45), 4, new cv.Scalar(255), -1); cv.circle(current, new cv.Point(22 + frame, 45), 4, new cv.Scalar(255), -1); cv.absdiff(current, previous, difference); cv.threshold(difference, mask, 10, 255, cv.THRESH_BINARY); cv.countNonZero(mask); processed += 1; }
      finally { previous.delete(); current.delete(); difference.delete(); mask.delete(); }
    }
    const measuredFps = processed / Math.max(.001, (performance.now() - started) / 1000);
    expect(processed).toBe(12); expect(measuredFps).toBeGreaterThan(0);
  }, 30_000);
});
