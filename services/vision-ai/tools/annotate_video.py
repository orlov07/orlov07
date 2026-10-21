"""Extrai e anota bolas de um vídeo local no formato YOLO.

O script deliberadamente não baixa vídeos de terceiros. Informe um arquivo que você
tenha autorização para utilizar.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


def split_for_frame(video_name: str, frame_number: int) -> str:
    digest = hashlib.sha256(f"{video_name}:{frame_number}".encode()).digest()[0]
    return "val" if digest < 51 else "train"


def yolo_box(x: int, y: int, width: int, height: int, image_width: int, image_height: int) -> str:
    center_x = (x + width / 2) / image_width
    center_y = (y + height / 2) / image_height
    return f"0 {center_x:.6f} {center_y:.6f} {width / image_width:.6f} {height / image_height:.6f}\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Anota a bola de beach tennis em quadros de um vídeo local.")
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--output", default=Path("dataset"), type=Path)
    parser.add_argument("--interval", default=12, type=int, help="Intervalo entre quadros candidatos.")
    args = parser.parse_args()

    if not args.video.is_file():
        raise SystemExit(f"Vídeo não encontrado: {args.video}")
    if args.interval < 1:
        raise SystemExit("--interval deve ser maior que zero")

    try:
        import cv2
    except ImportError as error:
        raise SystemExit('Instale as dependências com: pip install -e ".[training]"') from error

    for split in ("train", "val"):
        (args.output / "images" / split).mkdir(parents=True, exist_ok=True)
        (args.output / "labels" / split).mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit("Não foi possível abrir o vídeo.")

    frame_number = 0
    saved = 0
    print("ENTER: salvar caixa | S: sem bola | Q: encerrar")
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_number += 1
        if frame_number % args.interval:
            continue

        roi = cv2.selectROI("SETRA — marque somente a bola", frame, showCrosshair=True, fromCenter=True)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            break
        x, y, width, height = map(int, roi)
        if width <= 0 or height <= 0:
            continue

        split = split_for_frame(args.video.name, frame_number)
        stem = f"{args.video.stem}-{frame_number:08d}"
        image_path = args.output / "images" / split / f"{stem}.jpg"
        label_path = args.output / "labels" / split / f"{stem}.txt"
        cv2.imwrite(str(image_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 94])
        label_path.write_text(yolo_box(x, y, width, height, frame.shape[1], frame.shape[0]), encoding="utf-8")
        saved += 1
        print(f"\r{saved} exemplos salvos", end="", flush=True)

    capture.release()
    cv2.destroyAllWindows()
    print(f"\nConcluído: {saved} caixas anotadas em {args.output.resolve()}")


if __name__ == "__main__":
    main()
