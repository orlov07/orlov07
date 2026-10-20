from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_real_inference_is_not_faked() -> None:
    response = client.post("/v1/analyze", json={
        "match_id": "7d86e066-e734-4f99-b911-7c00175b5182",
        "video_clip_id": "d4516804-152b-4d04-b77b-47654291c49f",
    })
    assert response.status_code == 503


def test_development_simulation_is_labelled() -> None:
    response = client.post("/v1/analyze", json={
        "match_id": "7d86e066-e734-4f99-b911-7c00175b5182",
        "video_clip_id": "d4516804-152b-4d04-b77b-47654291c49f",
        "development_simulation": True,
    })
    assert response.status_code == 200
    assert response.json()["model_version"] == "development-simulation"
    assert response.json()["requires_confirmation"] is True
