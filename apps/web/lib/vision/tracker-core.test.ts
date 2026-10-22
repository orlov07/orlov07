import { describe, expect, it } from "vitest";
import { BallTracker, courtHomography, projectPoint, RallyEventAnalyzer, rgbToHsv, type CourtCalibration, type Detection, type TrackSample } from "./tracker-core";

const detection = (x: number, y: number, quality = .9): Detection => ({ position: { x, y }, radius: .015, colorScore: quality, geometryScore: quality, motionScore: quality, quality });
const calibration: CourtCalibration = { corners: [{ x: .1, y: .9 }, { x: .9, y: .9 }, { x: .75, y: .15 }, { x: .25, y: .15 }], net: [{ x: .18, y: .52 }, { x: .82, y: .52 }], frame: { width: 640, height: 360 } };

describe("traditional vision tracker core", () => {
  it("converts RGB to the OpenCV HSV range", () => { expect(rgbToHsv(255, 255, 0)).toMatchObject({ h: 30, s: 255, v: 255 }); });
  it("maps calibrated corners independent of resolution", () => {
    const h = courtHomography(calibration);
    expect(projectPoint(calibration.corners[0], h)).toEqual(expect.objectContaining({ x: expect.closeTo(0, 5), y: expect.closeTo(1, 5) }));
    expect(projectPoint(calibration.corners[2], h)).toEqual(expect.objectContaining({ x: expect.closeTo(1, 5), y: expect.closeTo(0, 5) }));
  });
  it("rejects a similar static object far from the prediction", () => {
    const tracker = new BallTracker(); let at = 0;
    for (let i = 0; i < 5; i += 1) tracker.update([detection(.2 + i * .02, .5)], at += 33);
    const result = tracker.update([detection(.32, .5), detection(.82, .5, 1)], at + 33);
    expect(result?.position.x).toBeLessThan(.4);
  });
  it("tolerates illumination quality changes", () => {
    const tracker = new BallTracker(); let sample = tracker.update([detection(.3, .4)], 100);
    sample = tracker.update([detection(.32, .4, .55)], 133); sample = tracker.update([detection(.34, .4, .5)], 166);
    expect(sample).not.toBeNull(); expect(sample!.confidence).toBeGreaterThan(40);
  });
  it("moves through occlusion, recovery, and tracking states", () => {
    const tracker = new BallTracker(); let at = 0;
    for (let i = 0; i < 4; i += 1) tracker.update([detection(.3 + i * .01, .4)], at += 33);
    expect(tracker.state).toBe("TRACKING");
    tracker.update([], at += 33); expect(tracker.state).toBe("OCCLUDED");
    for (let i = 0; i < 5; i += 1) tracker.update([], at += 33);
    expect(tracker.state).toBe("RECOVERING");
    tracker.update([detection(.38, .4)], at += 33); expect(tracker.state).toBe("RECOVERING");
    tracker.update([detection(.39, .4)], at += 33); tracker.update([detection(.40, .4)], at += 33);
    expect(tracker.state).toBe("TRACKING");
  });
  it("follows a direction change without jumping tracks", () => {
    const tracker = new BallTracker(); let at = 0;
    [.2,.25,.3,.27,.23].forEach(x => tracker.update([detection(x,.5)], at += 50));
    expect(tracker.history.at(-1)!.position.x).toBeLessThan(.3);
  });
  it("deduplicates candidate scoring events", () => {
    const analyzer = new RallyEventAnalyzer();
    const samples = Array.from({ length: 8 }, (_, i): TrackSample => ({ ...detection(.68 + i * .04, .6), at: 1000 + i * 50, predicted: { x: .68, y: .6 }, confidence: 80, speed: .5 }));
    const first = analyzer.analyze(samples, calibration, 2000);
    const duplicate = analyzer.analyze(samples, calibration, 2100);
    expect(first).not.toBeNull(); expect(duplicate).toBeNull();
  });
});
