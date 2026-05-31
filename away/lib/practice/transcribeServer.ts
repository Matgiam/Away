// Client for the Transkun server (Hugging Face Space).
// Heavy quality model — plan on 2-5 minutes per song on CPU.
//
// Flow:
//   1. POST /transcribe                 multipart audio  → { jobId }
//   2. GET  /jobs/{id}    (poll every 2 s)               → status
//   3. GET  /jobs/{id}/midi    once status == "done"     → MIDI bytes

import type { TranscribeProgressCallback } from "./transcribe";
import { markProcessing, releaseSlot, waitForTranscribeSlot } from "./transcribeQueue";

const POLL_INTERVAL_MS = 2000;
// Rough wall-clock estimate for the progress bar — actual time depends on song
// length and CPU load. Bar caps at 90% so it doesn't lie.
const ESTIMATED_TOTAL_SECONDS = 240;

type JobStatus = {
	jobId?: string;
	status: "queued" | "running" | "done" | "error";
	message?: string;
	error?: string | null;
	// Newer server (transcribe-server/main.py) reports elapsedSeconds. Older
	// server (transkun-server/main.py) reports a 0-100 progress number instead.
	// We accept either so the client works against both.
	elapsedSeconds?: number;
	progress?: number;
};

function authHeaders(apiKey: string | undefined): Record<string, string> {
	return apiKey ? { "X-API-Key": apiKey } : {};
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DOMException("Aborted", "AbortError"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

function formatElapsed(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export async function transcribeAudioToMidiServer(
	file: File,
	apiUrl: string,
	apiKey: string | undefined,
	onProgress: TranscribeProgressCallback,
	signal?: AbortSignal,
): Promise<ArrayBuffer> {
	const baseUrl = apiUrl.replace(/\/+$/, "");

	// 0. Client-side queue ---------------------------------------------------
	// Block until fewer than MAX_CONCURRENT app users are uploading/processing.
	// Surfaces the user's position to the progress UI while they wait.
	onProgress({ phase: "model", progress: 1, message: "Joining queue…" });
	const queueRowId = await waitForTranscribeSlot(
		file.name,
		({ positionInQueue, activeCount }) => {
			if (positionInQueue <= 1) {
				onProgress({
					phase: "model",
					progress: 2,
					message: "Your turn — preparing upload…",
				});
				return;
			}
			const ahead = positionInQueue - 1;
			const peopleWord = ahead === 1 ? "person" : "people";
			onProgress({
				phase: "model",
				progress: 1,
				message: `Queued — ${ahead} ${peopleWord} ahead of you (${activeCount} transcribing now)`,
			});
		},
		signal,
	);

	try {
		// 1. Upload ----------------------------------------------------------
		onProgress({ phase: "model", progress: 2, message: "Uploading audio…" });
		const form = new FormData();
		// The older server expects "audio", the newer one "file". Send both —
		// FastAPI ignores the unexpected key, and we don't have to care which is
		// deployed.
		form.append("audio", file, file.name);
		form.append("file", file, file.name);

		const submitResp = await fetch(`${baseUrl}/transcribe`, {
			method: "POST",
			body: form,
			headers: authHeaders(apiKey),
			signal,
		});
		if (!submitResp.ok) {
			const text = await submitResp.text().catch(() => "");
			throw new Error(
				`Server rejected the upload (${submitResp.status}): ${text || submitResp.statusText}`,
			);
		}
		const { jobId } = (await submitResp.json()) as { jobId: string };

		// Mark the queue row as 'processing' so it counts toward the concurrency
		// cap even after the upload phase finishes. Done before polling so other
		// waiters see an accurate active count.
		await markProcessing(queueRowId, jobId).catch(() => {});

		// 2. Poll until done -------------------------------------------------
		onProgress({ phase: "transcribe", progress: 8, message: "Queued for transcription…" });

		while (true) {
			if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
			await sleep(POLL_INTERVAL_MS, signal);

			const statusResp = await fetch(`${baseUrl}/jobs/${jobId}`, {
				headers: authHeaders(apiKey),
				signal,
			});
			if (!statusResp.ok) {
				throw new Error(`Status check failed (${statusResp.status})`);
			}
			const status = (await statusResp.json()) as JobStatus;

			if (status.status === "error") {
				throw new Error(status.error || status.message || "Transcription failed");
			}

			const elapsed = status.elapsedSeconds ?? 0;
			const elapsedLabel = elapsed > 0 ? formatElapsed(elapsed) : "";

			if (status.status === "done") {
				onProgress({
					phase: "midi",
					progress: 95,
					message: elapsedLabel
						? `Downloading MIDI… (${elapsedLabel} total)`
						: "Downloading MIDI…",
				});
				break;
			}

			// Prefer the server's own progress field if it sends one (old server);
			// otherwise estimate from elapsed time (new server).
			let pct: number;
			if (typeof status.progress === "number") {
				pct = 10 + Math.min(0.9, status.progress / 100) * 80;
			} else {
				const estimatedFraction = Math.min(0.9, elapsed / ESTIMATED_TOTAL_SECONDS);
				pct = 10 + estimatedFraction * 80;
			}
			const phase = status.status === "queued" ? "decode" : "transcribe";
			const message =
				status.status === "queued"
					? "Queued — waiting for a slot…"
					: elapsedLabel
						? `Transkun is transcribing… (${elapsedLabel} · this takes a few minutes)`
						: "Transkun is transcribing… (this takes a few minutes)";
			onProgress({ phase, progress: pct, message });
		}

		// 3. Download MIDI ---------------------------------------------------
		const midiResp = await fetch(`${baseUrl}/jobs/${jobId}/midi`, {
			headers: authHeaders(apiKey),
			signal,
		});
		if (!midiResp.ok) {
			const text = await midiResp.text().catch(() => "");
			throw new Error(`Failed to download MIDI (${midiResp.status}): ${text || ""}`);
		}
		const buffer = await midiResp.arrayBuffer();

		// Best-effort cleanup; server also TTL-deletes.
		fetch(`${baseUrl}/jobs/${jobId}`, {
			method: "DELETE",
			headers: authHeaders(apiKey),
		}).catch(() => {});

		onProgress({ phase: "done", progress: 100, message: "Done" });
		return buffer;
	} finally {
		// Free our queue slot on success, error, or cancel — otherwise the
		// position count would stay inflated until the row goes stale.
		await releaseSlot(queueRowId).catch(() => {});
	}
}
