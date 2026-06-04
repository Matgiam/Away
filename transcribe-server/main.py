"""
Transkun transcription server (Hugging Face Spaces Docker).

Wraps Yujia Yan's Transkun (https://github.com/yujia-yan/transkun) behind a
small FastAPI service. Heavy: PyTorch + transformer + semi-CRF. Plan on
2-5 minutes per song on a CPU Space.

Flow
----
1) POST /transcribe          multipart audio file → { jobId }
2) GET  /jobs/{jobId}        poll status → { status, message, elapsedSeconds }
3) GET  /jobs/{jobId}/midi   binary MIDI file once status == "done"

Auth: optional X-API-Key header matched against TRANSKUN_API_KEY.
Leave the env var empty to disable.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

API_KEY = os.environ.get("TRANSKUN_API_KEY", "").strip()
TRANSKUN_BIN = os.environ.get("TRANSKUN_BIN", "transkun")
TRANSKUN_DEVICE = os.environ.get("TRANSKUN_DEVICE", "cpu")
JOB_TTL_SECONDS = int(os.environ.get("JOB_TTL_SECONDS", "1800"))
JOB_TIMEOUT_SECONDS = int(os.environ.get("JOB_TIMEOUT_SECONDS", "1800"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(60 * 1024 * 1024)))
WORK_DIR = Path(os.environ.get("TRANSKUN_WORK_DIR", "/tmp/transkun-jobs"))
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]

WORK_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class Job:
    id: str
    status: str
    message: str = ""
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    input_path: Optional[Path] = None
    output_path: Optional[Path] = None


JOBS: dict[str, Job] = {}
JOBS_LOCK = threading.Lock()


def require_api_key(x_api_key: Optional[str]) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def cleanup_expired_jobs() -> None:
    now = time.time()
    with JOBS_LOCK:
        expired = [
            j.id
            for j in JOBS.values()
            if j.completed_at and now - j.completed_at > JOB_TTL_SECONDS
        ]
        for jid in expired:
            job = JOBS.pop(jid, None)
            if not job:
                continue
            if job.input_path:
                job.input_path.unlink(missing_ok=True)
            if job.output_path:
                job.output_path.unlink(missing_ok=True)
            d = WORK_DIR / jid
            if d.exists():
                shutil.rmtree(d, ignore_errors=True)


def run_transcription(job_id: str) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return

    job.status = "running"
    job.message = "Loading Transkun model…"
    job.started_at = time.time()

    cmd = [
        TRANSKUN_BIN,
        str(job.input_path),
        str(job.output_path),
        "--device",
        TRANSKUN_DEVICE,
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=JOB_TIMEOUT_SECONDS)
        if proc.returncode != 0:
            job.status = "error"
            job.error = (
                proc.stderr.strip()
                or proc.stdout.strip()
                or f"transkun exited with code {proc.returncode}"
            )
            job.message = "Failed"
            job.completed_at = time.time()
            return
        if not job.output_path or not job.output_path.exists():
            job.status = "error"
            job.error = "transkun finished but produced no MIDI file"
            job.message = "Failed"
            job.completed_at = time.time()
            return
        job.status = "done"
        job.message = "Done"
        job.completed_at = time.time()
    except subprocess.TimeoutExpired:
        job.status = "error"
        job.error = f"Transcription timed out after {JOB_TIMEOUT_SECONDS}s"
        job.message = "Timed out"
        job.completed_at = time.time()
    except FileNotFoundError:
        job.status = "error"
        job.error = f"`{TRANSKUN_BIN}` not found. Install with `pip install transkun`."
        job.message = "Failed"
        job.completed_at = time.time()
    except Exception as exc:
        job.status = "error"
        job.error = f"Unexpected error: {exc!r}"
        job.message = "Failed"
        job.completed_at = time.time()


app = FastAPI(title="Transkun transcription server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "transkun",
        "ok": True,
        "device": TRANSKUN_DEVICE,
        "jobs": len(JOBS),
    }


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "device": TRANSKUN_DEVICE, "jobs": len(JOBS)}


@app.post("/transcribe")
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> JSONResponse:
    require_api_key(x_api_key)
    cleanup_expired_jobs()

    job_id = str(uuid.uuid4())
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "input.mp3").suffix.lower() or ".mp3"
    if ext not in {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"}:
        raise HTTPException(status_code=415, detail=f"Unsupported audio format: {ext}")

    input_path = job_dir / f"input{ext}"
    output_path = job_dir / "output.mid"

    written = 0
    with input_path.open("wb") as out_fp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                out_fp.close()
                input_path.unlink(missing_ok=True)
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                )
            out_fp.write(chunk)

    if written == 0:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Empty upload")

    job = Job(
        id=job_id,
        status="queued",
        message="Queued",
        input_path=input_path,
        output_path=output_path,
    )
    with JOBS_LOCK:
        JOBS[job_id] = job

    background_tasks.add_task(run_transcription, job_id)
    return JSONResponse({"jobId": job_id})


@app.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> dict[str, object]:
    require_api_key(x_api_key)
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    elapsed = 0.0
    if job.started_at:
        end_time = job.completed_at or time.time()
        elapsed = max(0.0, end_time - job.started_at)

    return {
        "jobId": job.id,
        "status": job.status,
        "message": job.message,
        "error": job.error,
        "elapsedSeconds": round(elapsed, 2),
    }


@app.get("/jobs/{job_id}/midi")
def get_midi(
    job_id: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    require_api_key(x_api_key)
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "error":
        raise HTTPException(status_code=500, detail=job.error or "Transcription failed")
    if job.status != "done":
        raise HTTPException(status_code=409, detail=f"Job is {job.status}")
    if not job.output_path or not job.output_path.exists():
        raise HTTPException(status_code=410, detail="MIDI file no longer available")

    out_name = (job.input_path.stem + ".mid") if job.input_path else "transcription.mid"
    return FileResponse(job.output_path, media_type="audio/midi", filename=out_name)


@app.delete("/jobs/{job_id}")
def delete_job(
    job_id: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> dict[str, bool]:
    require_api_key(x_api_key)
    with JOBS_LOCK:
        job = JOBS.pop(job_id, None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.input_path:
        job.input_path.unlink(missing_ok=True)
    if job.output_path:
        job.output_path.unlink(missing_ok=True)
    shutil.rmtree(WORK_DIR / job_id, ignore_errors=True)
    return {"deleted": True}
