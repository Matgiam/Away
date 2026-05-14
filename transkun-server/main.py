"""FastAPI service that wraps the `transkun` CLI for the Away practice mode.

Endpoints:
  POST /transcribe       upload audio, returns { jobId }
  GET  /jobs/{id}        returns { status, progress, error }
  GET  /jobs/{id}/midi   returns the resulting MIDI file (when status = done)
  GET  /health           health check

Environment:
  TRANSKUN_DEVICE   "cpu" (default) or "cuda"
  TRANSKUN_TEMP     working directory for uploaded/generated files
  ALLOWED_ORIGINS   comma-separated list of allowed CORS origins
                    (default: http://localhost:3000)
"""

from __future__ import annotations

import asyncio
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Away Transkun Server")

ALLOWED_ORIGINS = [
	o.strip()
	for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
	if o.strip()
]

app.add_middleware(
	CORSMiddleware,
	allow_origins=ALLOWED_ORIGINS,
	allow_methods=["GET", "POST", "DELETE"],
	allow_headers=["*"],
)

TEMP_DIR = Path(os.environ.get("TRANSKUN_TEMP", Path.cwd() / "tmp"))
TEMP_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = os.environ.get("TRANSKUN_DEVICE", "cpu")

MAX_AUDIO_BYTES = 50 * 1024 * 1024
JOB_TTL_SECONDS = 60 * 60  # 1 hour
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"}
PROGRESS_REGEX = re.compile(r"(\d+(?:\.\d+)?)\s*%")


@dataclass
class Job:
	id: str
	status: str = "queued"  # queued | running | done | error
	progress: int = 0
	error: Optional[str] = None
	audio_path: Optional[Path] = None
	midi_path: Optional[Path] = None
	created_at: float = field(default_factory=time.time)


jobs: dict[str, Job] = {}


@app.on_event("startup")
async def _startup() -> None:
	asyncio.create_task(_cleanup_loop())


async def _cleanup_loop() -> None:
	while True:
		await asyncio.sleep(300)
		now = time.time()
		for job_id, job in list(jobs.items()):
			if now - job.created_at <= JOB_TTL_SECONDS:
				continue
			for path in (job.audio_path, job.midi_path):
				if path and path.exists():
					try:
						path.unlink()
					except OSError:
						pass
			jobs.pop(job_id, None)


@app.get("/health")
async def health() -> dict[str, object]:
	return {"ok": True, "device": DEVICE}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict[str, str]:
	if not audio.filename:
		raise HTTPException(400, "Missing filename")

	suffix = Path(audio.filename).suffix.lower()
	if suffix not in ALLOWED_EXTENSIONS:
		raise HTTPException(400, f"Unsupported audio extension: {suffix}")

	data = await audio.read()
	if len(data) == 0:
		raise HTTPException(400, "Empty file")
	if len(data) > MAX_AUDIO_BYTES:
		raise HTTPException(400, f"File too large (max {MAX_AUDIO_BYTES // (1024 * 1024)} MB)")

	job_id = str(uuid.uuid4())
	audio_path = TEMP_DIR / f"{job_id}_input{suffix}"
	with audio_path.open("wb") as f:
		f.write(data)

	job = Job(id=job_id, audio_path=audio_path)
	jobs[job_id] = job
	asyncio.create_task(_run_transcription(job))

	return {"jobId": job_id}


@app.get("/jobs/{job_id}")
async def job_status(job_id: str) -> dict[str, object]:
	job = jobs.get(job_id)
	if job is None:
		raise HTTPException(404, "Job not found")
	return {
		"status": job.status,
		"progress": job.progress,
		"error": job.error,
	}


@app.get("/jobs/{job_id}/midi")
async def job_midi(job_id: str) -> FileResponse:
	job = jobs.get(job_id)
	if job is None:
		raise HTTPException(404, "Job not found")
	if job.status != "done" or not job.midi_path or not job.midi_path.exists():
		raise HTTPException(409, "Job not complete")
	return FileResponse(
		job.midi_path,
		media_type="audio/midi",
		filename=f"{job_id}.mid",
	)


@app.delete("/jobs/{job_id}")
async def job_delete(job_id: str) -> dict[str, bool]:
	job = jobs.pop(job_id, None)
	if job is None:
		return {"ok": True}
	for path in (job.audio_path, job.midi_path):
		if path and path.exists():
			try:
				path.unlink()
			except OSError:
				pass
	return {"ok": True}


async def _run_transcription(job: Job) -> None:
	if job.audio_path is None:
		job.status = "error"
		job.error = "No audio path"
		return

	job.status = "running"
	job.progress = 0
	output_path = TEMP_DIR / f"{job.id}_output.mid"

	cmd = ["transkun", str(job.audio_path), str(output_path)]
	if DEVICE and DEVICE != "cpu":
		cmd += ["--device", DEVICE]

	try:
		proc = await asyncio.create_subprocess_exec(
			*cmd,
			stdout=asyncio.subprocess.PIPE,
			stderr=asyncio.subprocess.PIPE,
		)
	except FileNotFoundError:
		job.status = "error"
		job.error = "transkun binary not found. Run: pip install transkun"
		return
	except Exception as exc:  # noqa: BLE001
		job.status = "error"
		job.error = f"Failed to launch transkun: {exc}"
		return

	stderr_tail: list[str] = []

	async def _drain(stream: asyncio.StreamReader, capture: bool) -> None:
		while True:
			raw = await stream.readline()
			if not raw:
				return
			line = raw.decode("utf-8", errors="ignore")
			if capture:
				stderr_tail.append(line)
				if len(stderr_tail) > 40:
					stderr_tail.pop(0)
			match = PROGRESS_REGEX.search(line)
			if match:
				try:
					value = int(float(match.group(1)))
					# Cap at 99 until the process actually exits.
					if 0 <= value < 100:
						job.progress = max(job.progress, value)
				except ValueError:
					pass

	await asyncio.gather(
		_drain(proc.stdout, capture=False),
		_drain(proc.stderr, capture=True),
	)

	rc = await proc.wait()

	if rc == 0 and output_path.exists():
		job.status = "done"
		job.progress = 100
		job.midi_path = output_path
	else:
		job.status = "error"
		joined = "".join(stderr_tail).strip()
		job.error = f"transkun exited with code {rc}: {joined[-400:]}" if joined else f"transkun exited with code {rc}"

	# Audio input is no longer needed once transcription has completed
	if job.audio_path and job.audio_path.exists():
		try:
			job.audio_path.unlink()
		except OSError:
			pass
		job.audio_path = None
