from pathlib import Path
import importlib.util


TOOLS = Path(__file__).parents[1] / "tools"


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def test_yolo_box_is_normalized():
    module = load("annotate_video")
    assert module.yolo_box(10, 20, 20, 10, 100, 100) == "0 0.200000 0.250000 0.200000 0.100000\n"


def test_dataset_yaml_uses_absolute_root(tmp_path):
    module = load("train_ball_detector")
    contents = module.dataset_yaml(tmp_path)
    assert f"path: {tmp_path.resolve().as_posix()}" in contents
    assert "0: ball" in contents


def test_tile_origins_cover_edges_with_overlap():
    module = load("tile_dataset")
    origins = module.tile_origins(1280, 704, .2)
    assert origins[0] == 0
    assert origins[-1] == 576
    assert len(origins) >= 2
