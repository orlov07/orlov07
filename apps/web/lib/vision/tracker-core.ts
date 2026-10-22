export type Point = { x: number; y: number };
export type HsvColor = { h: number; s: number; v: number };
export type TrackerState = "SEARCHING" | "TRACKING" | "OCCLUDED" | "LOST" | "RECOVERING";

export interface CourtCalibration {
  corners: [Point, Point, Point, Point]; // near-left, near-right, far-right, far-left
  net: [Point, Point];
  frame: { width: number; height: number };
}

export interface Detection {
  position: Point;
  radius: number;
  colorScore: number;
  geometryScore: number;
  motionScore: number;
  quality: number;
}

export interface TrackSample extends Detection {
  at: number;
  predicted: Point;
  confidence: number;
  speed: number;
}

export type PointCandidate = {
  id: string;
  suggestedTeam: "A" | "B" | null;
  reason: string;
  confidence: number;
  at: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function rgbToHsv(red: number, green: number, blue: number): HsvColor {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { h: hue / 2, s: max ? (delta / max) * 255 : 0, v: max * 255 };
}

export function solveHomography(source: [Point, Point, Point, Point], target: [Point, Point, Point, Point]): number[] {
  const matrix: number[][] = [];
  const vector: number[] = [];
  source.forEach((point, index) => {
    const out = target[index]!;
    matrix.push([point.x, point.y, 1, 0, 0, 0, -out.x * point.x, -out.x * point.y]); vector.push(out.x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -out.y * point.x, -out.y * point.y]); vector.push(out.y);
  });
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    [vector[column], vector[pivot]] = [vector[pivot]!, vector[column]!];
    const divisor = matrix[column]![column]!;
    if (Math.abs(divisor) < 1e-10) throw new Error("Calibração da quadra inválida: cantos colineares.");
    for (let item = column; item < 8; item += 1) matrix[column]![item] = matrix[column]![item]! / divisor;
    vector[column] = vector[column]! / divisor;
    for (let row = 0; row < 8; row += 1) if (row !== column) {
      const factor = matrix[row]![column]!;
      for (let item = column; item < 8; item += 1) matrix[row]![item] = matrix[row]![item]! - factor * matrix[column]![item]!;
      vector[row] = vector[row]! - factor * vector[column]!;
    }
  }
  return [...vector, 1];
}

export function projectPoint(point: Point, homography: number[]): Point {
  const scale = homography[6]! * point.x + homography[7]! * point.y + homography[8]!;
  return { x: (homography[0]! * point.x + homography[1]! * point.y + homography[2]!) / scale, y: (homography[3]! * point.x + homography[4]! * point.y + homography[5]!) / scale };
}

export function courtHomography(calibration: CourtCalibration): number[] {
  return solveHomography(calibration.corners, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
}

class AlphaBetaKalman {
  position: Point = { x: 0, y: 0 };
  velocity: Point = { x: 0, y: 0 };
  private initialized = false;
  predict(dt: number): Point { return { x: this.position.x + this.velocity.x * dt, y: this.position.y + this.velocity.y * dt }; }
  update(measurement: Point, dt: number, quality: number): Point {
    if (!this.initialized) { this.position = { ...measurement }; this.initialized = true; return this.position; }
    const predicted = this.predict(dt), residual = { x: measurement.x - predicted.x, y: measurement.y - predicted.y };
    const alpha = .35 + .45 * clamp(quality), beta = .05 + .18 * clamp(quality);
    this.position = { x: predicted.x + alpha * residual.x, y: predicted.y + alpha * residual.y };
    this.velocity = { x: this.velocity.x + beta * residual.x / Math.max(.008, dt), y: this.velocity.y + beta * residual.y / Math.max(.008, dt) };
    return this.position;
  }
  reset(point?: Point) { this.initialized = Boolean(point); this.position = point ? { ...point } : { x: 0, y: 0 }; this.velocity = { x: 0, y: 0 }; }
}

export class BallTracker {
  state: TrackerState = "SEARCHING";
  history: TrackSample[] = [];
  private filter = new AlphaBetaKalman();
  private lastAt = 0;
  private missed = 0;
  private hits = 0;

  reset(seed?: Point) { this.state = "SEARCHING"; this.history = []; this.filter.reset(seed); this.lastAt = 0; this.missed = 0; this.hits = 0; }

  update(detections: Detection[], at: number): TrackSample | null {
    const dt = this.lastAt ? clamp((at - this.lastAt) / 1000, .008, .2) : 1 / 30;
    const predicted = this.filter.predict(dt);
    const gate = this.state === "LOST" || this.state === "SEARCHING" ? .42 : .08 + Math.min(.18, this.missed * .035);
    const ranked = detections.map(detection => {
      const predictionScore = this.lastAt ? clamp(1 - distance(detection.position, predicted) / gate) : .65;
      const confidence = 100 * (.28 * detection.colorScore + .19 * detection.geometryScore + .17 * detection.motionScore + .16 * detection.quality + .20 * predictionScore);
      return { detection, confidence, predictionScore };
    }).filter(item => !this.lastAt || item.predictionScore > 0).sort((a, b) => b.confidence - a.confidence);
    const best = ranked[0];
    this.lastAt = at;
    if (!best || best.confidence < 40) {
      this.missed += 1; this.hits = 0;
      this.state = this.missed <= 4 ? "OCCLUDED" : this.missed <= 14 ? "RECOVERING" : "LOST";
      return null;
    }
    const wasMissing = this.missed > 0 || this.state === "LOST";
    const position = this.filter.update(best.detection.position, dt, best.detection.quality);
    this.missed = 0; this.hits += 1;
    this.state = wasMissing && this.hits < 3 ? "RECOVERING" : this.hits >= 3 ? "TRACKING" : "SEARCHING";
    const sample: TrackSample = { ...best.detection, at, position, predicted, confidence: Math.round(best.confidence), speed: Math.hypot(this.filter.velocity.x, this.filter.velocity.y) };
    this.history = [...this.history.slice(-29), sample];
    return sample;
  }
}

export class RallyEventAnalyzer {
  private lastCandidateAt = 0;
  private sequence = 0;
  analyze(history: TrackSample[], calibration: CourtCalibration, now: number): PointCandidate | null {
    if (history.length < 6 || (this.lastCandidateAt > 0 && now - this.lastCandidateAt < 3000)) return null;
    const recent = history.slice(-8), last = recent.at(-1)!;
    if (now - last.at < 500) return null;
    const transform = courtHomography(calibration);
    const court = recent.map(sample => projectPoint(sample.position, transform));
    const end = court.at(-1)!, previous = court.at(-3)!;
    const outside = end.x < -.04 || end.x > 1.04 || end.y < -.05 || end.y > 1.05;
    const decisiveMotion = distance(end, previous) > .04;
    if (!outside || !decisiveMotion) return null;
    const lastSide = previous.y < .5 ? "far" : "near";
    this.lastCandidateAt = now;
    return { id: `vision-${now}-${++this.sequence}`, suggestedTeam: lastSide === "near" ? "B" : "A", reason: "Trajetória saiu da quadra calibrada após movimento consistente; confirme quem venceu o rally.", confidence: Math.round(clamp(last.confidence / 100 * .8) * 100), at: now };
  }
}
