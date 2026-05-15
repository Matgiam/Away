# Away Transkun Server (optional)

> **You probably don't need this.** Audio-to-MIDI now runs in the browser via
> [@spotify/basic-pitch](https://www.npmjs.com/package/@spotify/basic-pitch),
> no server required. Keep this folder only if you specifically want to run
> Transkun (better piano transcription quality, but needs a Python service).
> The Next.js app does **not** call this server in its default configuration.

Audio-to-MIDI transcription service wrapping [Transkun](https://github.com/yujia-yan/Transkun).

## Run locally

Requires Python 3.10+ and `ffmpeg` available on PATH (for audio decoding).

```
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

If you have an NVIDIA GPU:

```
TRANSKUN_DEVICE=cuda uvicorn main:app --port 8000
```

CPU transcription roughly tracks audio duration × 1.5–2. GPU is ~10× faster.

## Run with Docker

```
docker build -t away-transkun .
docker run -p 8000:8000 -e ALLOWED_ORIGINS=http://localhost:3000 away-transkun
```

## Connect to the Next.js app

Add this to the Next.js project's `.env.local`:

```
NEXT_PUBLIC_TRANSCRIPTION_URL=http://localhost:8000
```

In production, set it to the public URL of your deployed service.

## Endpoints

| Method | Path                | Notes                                          |
|--------|---------------------|------------------------------------------------|
| GET    | `/health`           | `{ ok, device }`                               |
| POST   | `/transcribe`       | `multipart/form-data` with `audio` field       |
| GET    | `/jobs/{id}`        | `{ status, progress, error }`                  |
| GET    | `/jobs/{id}/midi`   | Resulting MIDI (only when `status === "done"`) |
| DELETE | `/jobs/{id}`        | Cancel/cleanup                                  |

`status` values: `queued`, `running`, `done`, `error`.

## Notes

* Jobs are kept in memory and pruned after one hour. Behind a load balancer,
  put this behind a single replica or back it with Redis.
* The default Transkun checkpoint is `Transkun V2 No Pedal Extension`. Override
  via the `--weight` / `--conf` arguments if you want a different model
  (extend the subprocess call in `main.py`).
* Allowed audio extensions: `.mp3, .wav, .flac, .ogg, .m4a, .aac, .aiff`.
  Max file size: 50 MB.
