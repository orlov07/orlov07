"""Gera uma grade visual distribuída para auditorar caixas YOLO."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--samples", type=int, default=24)
    args = parser.parse_args()
    images = sorted([*(args.dataset / "images" / "train").glob("*.jpg"), *(args.dataset / "images" / "val").glob("*.jpg")])
    positives = [path for path in images if (args.dataset / "labels" / path.parent.name / f"{path.stem}.txt").read_text(encoding="utf-8").strip()]
    if not positives:
        raise SystemExit("Nenhum rótulo positivo encontrado.")
    total = min(args.samples, len(positives))
    picks = [positives[round(index * (len(positives) - 1) / max(total - 1, 1))] for index in range(total)]
    tiles = []
    for path in picks:
        image = cv2.imread(str(path)); height, width = image.shape[:2]
        label = args.dataset / "labels" / path.parent.name / f"{path.stem}.txt"
        for line in label.read_text(encoding="utf-8").splitlines():
            _, cx, cy, bw, bh = map(float, line.split())
            first = (int((cx - bw / 2) * width), int((cy - bh / 2) * height))
            second = (int((cx + bw / 2) * width), int((cy + bh / 2) * height))
            cv2.rectangle(image, first, second, (0, 0, 255), 4)
            cv2.circle(image, (int(cx * width), int(cy * height)), 10, (0, 255, 255), 2)
        image = cv2.resize(image, (400, 225))
        cv2.putText(image, path.stem[-8:], (8, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 2)
        tiles.append(image)
    while len(tiles) % 4:
        tiles.append(np.zeros_like(tiles[0]))
    sheet = cv2.vconcat([cv2.hconcat(tiles[index:index + 4]) for index in range(0, len(tiles), 4)])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), sheet)
    print(f"{len(positives)} positivos; auditoria em {args.output.resolve()}")


if __name__ == "__main__":
    main()
