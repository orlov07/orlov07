"""Remove pseudo-rótulos que caem dentro de pessoas detectadas.

Isso elimina principalmente munhequeiras, logos e detalhes de roupa confundidos
com a bola. Quadros rejeitados não viram negativos, pois podem conter bola real.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="yolo11n.pt")
    args = parser.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.model)
    accepted = rejected = negatives = 0
    for split in ("train", "val"):
        source_images = args.input / "images" / split
        source_labels = args.input / "labels" / split
        target_images = args.output / "images" / split
        target_labels = args.output / "labels" / split
        target_images.mkdir(parents=True, exist_ok=True)
        target_labels.mkdir(parents=True, exist_ok=True)

        images = sorted(source_images.glob("*.jpg"))
        positives = [image for image in images if (source_labels / f"{image.stem}.txt").read_text(encoding="utf-8").strip()]
        people_by_path: dict[Path, list[list[float]]] = {}
        for result in model.predict(positives, classes=[0], conf=.2, imgsz=640, batch=8, verbose=False, device="cpu"):
            people_by_path[Path(result.path)] = result.boxes.xyxy.cpu().tolist()

        for image in images:
            label_path = source_labels / f"{image.stem}.txt"
            contents = label_path.read_text(encoding="utf-8").strip()
            keep = not contents
            if contents:
                import cv2
                frame = cv2.imread(str(image))
                height, width = frame.shape[:2]
                _, cx, cy, _, _ = map(float, contents.splitlines()[0].split())
                point_x, point_y = cx * width, cy * height
                people = people_by_path.get(image.resolve(), people_by_path.get(image, []))
                inside_person = any(
                    x1 - (x2 - x1) * .08 <= point_x <= x2 + (x2 - x1) * .08
                    and y1 - (y2 - y1) * .05 <= point_y <= y2 + (y2 - y1) * .05
                    for x1, y1, x2, y2 in people
                )
                keep = not inside_person
                accepted += int(keep); rejected += int(not keep)
            else:
                negatives += 1
            if keep:
                shutil.copy2(image, target_images / image.name)
                shutil.copy2(label_path, target_labels / label_path.name)
    print(f"Aceitos: {accepted} positivos e {negatives} negativos; rejeitados sobre pessoas: {rejected}")


if __name__ == "__main__":
    main()
