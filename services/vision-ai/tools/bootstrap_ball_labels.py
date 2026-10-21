"""Gera rótulos iniciais conservadores para uma bola amarela em câmera fixa.

Os rótulos são pseudo-anotações e precisam de inspeção antes do treino final.
O algoritmo combina subtração de fundo, HSV, tamanho e continuidade temporal.
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from pathlib import Path

from annotate_video import split_for_frame, yolo_box


@dataclass
class Detection:
    frame: int
    x: int
    y: int
    width: int
    height: int
    score: float

    @property
    def center(self) -> tuple[float, float]:
        return self.x + self.width / 2, self.y + self.height / 2


@dataclass
class Track:
    detections: list[Detection] = field(default_factory=list)
    missed: int = 0


def distance(left: Detection, right: Detection) -> float:
    ax, ay = left.center
    bx, by = right.center
    return math.hypot(ax - bx, ay - by)


def valid_track(track: Track) -> bool:
    if len(track.detections) < 6:
        return False
    first, last = track.detections[0], track.detections[-1]
    span = distance(first, last)
    speeds = [distance(a, b) / max(1, b.frame - a.frame) for a, b in zip(track.detections, track.detections[1:])]
    mean_speed = sum(speeds) / len(speeds)
    path_length = sum(distance(a, b) for a, b in zip(track.detections, track.detections[1:]))
    mean_area = sum(item.width * item.height for item in track.detections) / len(track.detections)
    straightness = path_length / max(span, 1)
    return span >= 65 and 4 <= mean_speed <= 75 and mean_area <= 90 and straightness <= 2.2


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria pseudo-rótulos conservadores da bola.")
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("dataset-bootstrap"))
    parser.add_argument("--max-positive", type=int, default=1200)
    parser.add_argument("--negative-every", type=int, default=180)
    args = parser.parse_args()

    try:
        import cv2
        import numpy as np
    except ImportError as error:
        raise SystemExit('Instale as dependências com: pip install -e ".[training]"') from error

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit(f"Não foi possível abrir {args.video}")

    subtractor = cv2.createBackgroundSubtractorMOG2(history=360, varThreshold=22, detectShadows=False)
    active: list[Track] = []
    finished: list[Track] = []
    frame_number = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_number += 1
        foreground = subtractor.apply(frame)
        if frame_number < 180 or frame_number % 2:
            continue
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # Amarelo/verde-limão e amarelo alaranjado sob iluminação variável.
        color = cv2.inRange(hsv, np.array([20, 125, 145]), np.array([43, 255, 255]))
        mask = cv2.bitwise_and(color, foreground)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        count, _, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
        candidates: list[Detection] = []
        for index in range(1, count):
            x, y, width, height, area = map(int, stats[index])
            if not (2 <= area <= 70 and 1 <= width <= 16 and 1 <= height <= 16):
                continue
            aspect = width / max(height, 1)
            if not .28 <= aspect <= 3.5:
                continue
            cx, cy = centroids[index]
            if cy < 18 or cy > min(570, frame.shape[0] - 15):
                continue
            fill = area / (width * height)
            score = fill * 50 - abs(width - height) * 1.5 - area * .03
            candidates.append(Detection(frame_number, x, y, width, height, score))

        unused = set(range(len(candidates)))
        for track in active:
            if not track.detections:
                continue
            options = [(distance(track.detections[-1], candidate), index) for index, candidate in enumerate(candidates) if index in unused]
            if options:
                nearest, index = min(options)
                allowed = 70 + track.missed * 35
                if nearest <= allowed:
                    track.detections.append(candidates[index]); track.missed = 0; unused.remove(index); continue
            track.missed += 1

        still_active = []
        for track in active:
            if track.missed > 4:
                finished.append(track)
            else:
                still_active.append(track)
        active = still_active
        active.extend(Track([candidates[index]]) for index in unused)
        if frame_number % 3000 == 0:
            print(f"Analisados {frame_number} quadros; {len(finished)} trajetórias candidatas", flush=True)

    finished.extend(active)
    capture.release()
    valid = [track for track in finished if valid_track(track)]
    detections: dict[int, Detection] = {}
    for track in valid:
        for item in track.detections:
            current = detections.get(item.frame)
            if current is None or item.score > current.score:
                detections[item.frame] = item

    ordered = sorted(detections)
    if len(ordered) > args.max_positive:
        step = len(ordered) / args.max_positive
        ordered = [ordered[int(index * step)] for index in range(args.max_positive)]
    selected = set(ordered)

    for split in ("train", "val"):
        (args.output / "images" / split).mkdir(parents=True, exist_ok=True)
        (args.output / "labels" / split).mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(args.video))
    frame_number = 0; positives = 0; negatives = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_number += 1
        detection = detections.get(frame_number) if frame_number in selected else None
        negative = frame_number % args.negative_every == 0 and frame_number not in detections
        if detection is None and not negative:
            continue
        split = split_for_frame(args.video.name, frame_number)
        stem = f"{args.video.stem}-{frame_number:08d}"
        cv2.imwrite(str(args.output / "images" / split / f"{stem}.jpg"), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        label = ""
        if detection:
            padding = max(3, round(max(detection.width, detection.height) * .45))
            x = max(0, detection.x - padding); y = max(0, detection.y - padding)
            width = min(frame.shape[1] - x, detection.width + padding * 2)
            height = min(frame.shape[0] - y, detection.height + padding * 2)
            label = yolo_box(x, y, width, height, frame.shape[1], frame.shape[0]); positives += 1
        else:
            negatives += 1
        (args.output / "labels" / split / f"{stem}.txt").write_text(label, encoding="utf-8")
    capture.release()
    print(f"Gerados {positives} positivos e {negatives} negativos em {args.output.resolve()}")
    print("IMPORTANTE: revise visualmente os pseudo-rótulos antes do treino final.")


if __name__ == "__main__":
    main()
