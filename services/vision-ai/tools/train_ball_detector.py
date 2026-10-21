"""Treina e exporta um detector YOLO para a bola de beach tennis."""

from __future__ import annotations

import argparse
from pathlib import Path


def dataset_yaml(dataset: Path) -> str:
    root = dataset.resolve().as_posix()
    return f"path: {root}\ntrain: images/train\nval: images/val\nnames:\n  0: ball\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Treina o detector de bola do SETRA.")
    parser.add_argument("--dataset", type=Path, default=Path("dataset"))
    parser.add_argument("--model", default="yolo11s.pt")
    parser.add_argument("--epochs", type=int, default=140)
    parser.add_argument("--image-size", type=int, default=1280)
    parser.add_argument("--batch", default="-1", help="-1 usa automaticamente cerca de 60% da GPU.")
    parser.add_argument("--device", default=None, help="Ex.: 0 para GPU NVIDIA ou cpu.")
    parser.add_argument("--freeze", type=int, default=0, help="Congela as primeiras camadas para acelerar transfer learning.")
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--export", action="store_true", help="Exporta também o melhor modelo para ONNX.")
    args = parser.parse_args()

    train_images = args.dataset / "images" / "train"
    val_images = args.dataset / "images" / "val"
    if not any(train_images.glob("*.jpg")) or not any(val_images.glob("*.jpg")):
        raise SystemExit("Dataset incompleto. Anote exemplos de treino e validação primeiro.")

    try:
        from ultralytics import YOLO
    except ImportError as error:
        raise SystemExit('Instale as dependências com: pip install -e ".[training]"') from error

    yaml_path = args.dataset / "dataset.yaml"
    yaml_path.write_text(dataset_yaml(args.dataset), encoding="utf-8")
    model = YOLO(args.model)
    model.train(
        data=str(yaml_path), epochs=args.epochs, imgsz=args.image_size, batch=float(args.batch) if "." in args.batch else int(args.batch), device=args.device,
        project=str(Path("runs").resolve()), name="setra-ball", patience=15, single_cls=True, cache="disk", workers=args.workers, freeze=args.freeze,
        degrees=2, translate=.05, scale=.25, fliplr=.5, flipud=0,
        hsv_h=.012, hsv_s=.35, hsv_v=.28, mosaic=.35, close_mosaic=15,
    )
    best = Path(model.trainer.best) if model.trainer else Path("runs/setra-ball/weights/best.pt")
    if best.exists():
        if args.export:
            YOLO(str(best)).export(format="onnx", imgsz=args.image_size, simplify=True)
        print(f"Modelo treinado: {best.resolve()}")


if __name__ == "__main__":
    main()
