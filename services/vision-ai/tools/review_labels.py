"""Revisão humana rápida dos pseudo-rótulos antes do treinamento.

Teclas: A aceita, R rejeita, C corrige a caixa, Q salva e encerra.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from annotate_video import yolo_box


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("dataset-reviewed"))
    parser.add_argument("--video", type=Path, help="Vídeo original para mostrar o candidato em movimento.")
    parser.add_argument("--context-frames", type=int, default=12)
    args = parser.parse_args()
    import cv2

    progress_path = args.output / "reviewed.txt"
    reviewed = (
        set(progress_path.read_text(encoding="utf-8").splitlines())
        if progress_path.exists()
        else set()
    )
    candidates = []
    for split in ("train", "val"):
        label_dir = args.input / "labels" / split
        for label in sorted(label_dir.glob("*.txt")):
            if label.read_text(encoding="utf-8").strip():
                review_id = f"{split}/{label.stem}"
                if review_id not in reviewed:
                    candidates.append((review_id, split, args.input / "images" / split / f"{label.stem}.jpg", label))
        (args.output / "images" / split).mkdir(parents=True, exist_ok=True)
        (args.output / "labels" / split).mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(args.video)) if args.video else None
    window_name = "SETRA - revisar bola em movimento"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    accepted = rejected = corrected = 0
    for index, (review_id, split, image_path, label_path) in enumerate(candidates, 1):
        image = cv2.imread(str(image_path)); height, width = image.shape[:2]
        line = label_path.read_text(encoding="utf-8").strip().splitlines()[0]
        _, cx, cy, bw, bh = map(float, line.split())
        x1 = int((cx - bw / 2) * width); y1 = int((cy - bh / 2) * height)
        x2 = int((cx + bw / 2) * width); y2 = int((cy + bh / 2) * height)
        preview = image.copy()
        cv2.rectangle(preview, (x1, y1), (x2, y2), (0, 255, 255), 3)
        cv2.putText(preview, f"{index}/{len(candidates)}  A aceitar | R rejeitar | C corrigir | Q sair", (18, 35), cv2.FONT_HERSHEY_SIMPLEX, .8, (0, 255, 255), 2)
        if capture and capture.isOpened():
            frame_number = int(image_path.stem.rsplit("-", 1)[-1])
            first = max(0, frame_number - args.context_frames)
            capture.set(cv2.CAP_PROP_POS_FRAMES, first)
            for current_frame in range(first, frame_number + args.context_frames + 1):
                ok, context = capture.read()
                if not ok:
                    break
                color = (0, 255, 255) if current_frame == frame_number else (90, 190, 90)
                cv2.putText(context, f"Movimento {current_frame - frame_number:+d}", (18, 35), cv2.FONT_HERSHEY_SIMPLEX, .8, color, 2)
                if current_frame == frame_number:
                    cv2.rectangle(context, (x1, y1), (x2, y2), (0, 255, 255), 3)
                cv2.imshow(window_name, context)
                if (cv2.waitKey(55) & 0xFF) in (ord("q"), 27):
                    capture.release(); cv2.destroyAllWindows(); return
        cv2.imshow(window_name, preview)
        key = cv2.waitKey(0) & 0xFF
        while key not in (ord("a"), ord("A"), ord("r"), ord("R"), ord("c"), ord("C"), ord("q"), ord("Q"), 27):
            key = cv2.waitKey(0) & 0xFF
        if key in (ord("q"), ord("Q"), 27):
            break
        output_label = line + "\n"
        if key in (ord("c"), ord("C")):
            x, y, box_width, box_height = map(int, cv2.selectROI(window_name, image, True, True))
            if box_width <= 0 or box_height <= 0:
                rejected += 1
                progress_path.parent.mkdir(parents=True, exist_ok=True)
                with progress_path.open("a", encoding="utf-8") as progress:
                    progress.write(review_id + "\n")
                continue
            output_label = yolo_box(x, y, box_width, box_height, width, height)
            corrected += 1
        elif key in (ord("a"), ord("A")):
            accepted += 1
        else:
            rejected += 1
            progress_path.parent.mkdir(parents=True, exist_ok=True)
            with progress_path.open("a", encoding="utf-8") as progress:
                progress.write(review_id + "\n")
            continue
        shutil.copy2(image_path, args.output / "images" / split / image_path.name)
        (args.output / "labels" / split / label_path.name).write_text(output_label, encoding="utf-8")
        with progress_path.open("a", encoding="utf-8") as progress:
            progress.write(review_id + "\n")
    if capture:
        capture.release()
    cv2.destroyAllWindows()
    print(f"Aceitos: {accepted}; corrigidos: {corrected}; rejeitados: {rejected}")


if __name__ == "__main__":
    main()
