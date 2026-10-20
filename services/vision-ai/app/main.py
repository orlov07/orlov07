from enum import StrEnum
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="SETRA Vision AI", version="0.1.0")


class Team(StrEnum):
    A = "team_a"
    B = "team_b"


class AnalysisRequest(BaseModel):
    match_id: UUID
    video_clip_id: UUID
    development_simulation: bool = False


class Prediction(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    match_id: UUID
    event_type: str = "possible_point_end"
    suggested_winner: Team
    confidence: float = Field(ge=0, le=1)
    requires_confirmation: bool = True
    model_version: str
    video_clip_id: UUID


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "inference": "unavailable"}


@app.post("/v1/analyze", response_model=Prediction)
def analyze(request: AnalysisRequest) -> Prediction:
    if not request.development_simulation:
        raise HTTPException(status_code=503, detail="Modelo de inferência ainda não configurado.")
    return Prediction(
        match_id=request.match_id,
        video_clip_id=request.video_clip_id,
        suggested_winner=Team.A,
        confidence=0.5,
        model_version="development-simulation",
    )
