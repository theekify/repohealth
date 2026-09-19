"""FastAPI app exposing repo ownership analysis as JSON."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.ownership import analyze_repo_ownership, compute_bus_factor

app = FastAPI(title="RepoHealth API")

# Vite's dev server runs on 5173 by default — without this, the browser
# blocks the frontend from calling this API at all (CORS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class FileOwnershipResponse(BaseModel):
    path: str
    total_lines: int
    dominant_author: str
    dominant_share: float
    contributor_count: int


class AnalysisResponse(BaseModel):
    files: list[FileOwnershipResponse]
    bus_factor: int
    key_people: list[str]
    total_files_analyzed: int


class AnalyzeRequest(BaseModel):
    repo_path: str


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(req: AnalyzeRequest):
    try:
        ownerships = analyze_repo_ownership(req.repo_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not ownerships:
        raise HTTPException(
            status_code=400,
            detail="No analyzable files found — is this a valid git repo path?",
        )

    bus_factor, key_people = compute_bus_factor(ownerships)

    files = [
        FileOwnershipResponse(
            path=f.path,
            total_lines=f.total_lines,
            dominant_author=f.dominant_author,
            dominant_share=f.dominant_share,
            contributor_count=f.contributor_count,
        )
        for f in ownerships
    ]
    # Riskiest files first — high ownership concentration = bigger risk
    files.sort(key=lambda f: -f.dominant_share)

    return AnalysisResponse(
        files=files,
        bus_factor=bus_factor,
        key_people=key_people,
        total_files_analyzed=len(files),
    )


@app.get("/health")
def health():
    return {"status": "ok"}