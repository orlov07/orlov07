"""Mantém pseudo-rótulos confirmados por um detector COCO de sports ball."""

from __future__ import annotations

import argparse
import math
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="yolo11n.pt")
    args = parser.parse_args()
    from ultralytics import YOLO
    import cv2

    model = YOLO(args.model)
    accepted = 0
    for split in ("train", "val"):
        image_dir = args.input / "images" / split
        label_dir = args.input / "labels" / split
        target_images = args.output / "images" / split
        target_labels = args.output / "labels" / split
        target_images.mkdir(parents=True, exist_ok=True); target_labels.mkdir(parents=True, exist_ok=True)
        positives = [path for path in sorted(image_dir.glob("*.jpg")) if (label_dir / f"{path.stem}.txt").read_text(encoding="utf-8").strip()]
        for result in model.predict(positives, classes=[32], conf=.01, imgsz=1280, batch=4, verbose=False, device="cpu"):
            path = Path(result.path)
            image = cv2.imread(str(path)); height, width = image.shape[:2]
            label_path = label_dir / f"{path.stem}.txt"
            _, cx, cy, _, _ = map(float, label_path.read_text(encoding="utf-8").split())
            x, y = cx * width, cy * height
            boxes = result.boxes.xyxy.cpu().tolist()
            close = any(math.hypot(x - (x1 + x2) / 2, y - (y1 + y2) / 2) <= max(35, (x2 - x1 + y2 - y1)) for x1, y1, x2, y2 in boxes)
            if close:
                shutil.copy2(path, target_images / path.name)
                shutil.copy2(label_path, target_labels / label_path.name)
                accepted += 1
    print(f"Pseudo-rótulos confirmados como sports ball: {accepted}")


if __name__ == "__main__":
    main()
