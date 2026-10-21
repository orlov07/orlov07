"""Cria recortes sobrepostos para ampliar bolas pequenas antes do treino."""

from __future__ import annotations

import argparse
from pathlib import Path


def tile_origins(size: int, tile: int, overlap: float) -> list[int]:
    if tile >= size:
        return [0]
    step = max(1, int(tile * (1 - overlap)))
    values = list(range(0, size - tile + 1, step))
    if values[-1] != size - tile:
        values.append(size - tile)
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera tiles para detecção de objetos pequenos.")
    parser.add_argument("--dataset", type=Path, default=Path("dataset"))
    parser.add_argument("--tile-width", type=int, default=704)
    parser.add_argument("--tile-height", type=int, default=448)
    parser.add_argument("--overlap", type=float, default=.2)
    args = parser.parse_args()
    try:
        import cv2
    except ImportError as error:
        raise SystemExit('Instale as dependências com: pip install -e ".[training]"') from error

    for split in ("train", "val"):
        image_dir = args.dataset / "images" / split
        label_dir = args.dataset / "labels" / split
        output_images = args.dataset / "tiles" / "images" / split
        output_labels = args.dataset / "tiles" / "labels" / split
        output_images.mkdir(parents=True, exist_ok=True)
        output_labels.mkdir(parents=True, exist_ok=True)
        for image_path in image_dir.glob("*.jpg"):
            image = cv2.imread(str(image_path))
            if image is None:
                continue
            height, width = image.shape[:2]
            labels = []
            label_path = label_dir / f"{image_path.stem}.txt"
            if label_path.exists():
                for line in label_path.read_text(encoding="utf-8").splitlines():
                    cls, cx, cy, bw, bh = map(float, line.split())
                    labels.append((int(cls), cx * width, cy * height, bw * width, bh * height))
            for top in tile_origins(height, args.tile_height, args.overlap):
                for left in tile_origins(width, args.tile_width, args.overlap):
                    tile_labels = []
                    for cls, cx, cy, bw, bh in labels:
                        if left <= cx < left + args.tile_width and top <= cy < top + args.tile_height:
                            tile_labels.append(f"{cls} {(cx-left)/args.tile_width:.6f} {(cy-top)/args.tile_height:.6f} {bw/args.tile_width:.6f} {bh/args.tile_height:.6f}")
                    # Mantém parte dos negativos difíceis; todos os tiles positivos são preservados.
                    signature = (left * 31 + top * 17 + sum(image_path.stem.encode())) % 5
                    if not tile_labels and signature:
                        continue
                    stem = f"{image_path.stem}-x{left}-y{top}"
                    cv2.imwrite(str(output_images / f"{stem}.jpg"), image[top:top + args.tile_height, left:left + args.tile_width])
                    (output_labels / f"{stem}.txt").write_text("\n".join(tile_labels) + ("\n" if tile_labels else ""), encoding="utf-8")


if __name__ == "__main__":
    main()
