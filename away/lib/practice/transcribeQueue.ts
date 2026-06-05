// ============================================================================
// practice/transcribeQueue.ts
// ----------------------------------------------------------------------------
// Client-side queue for Transkun (HF Space) audio→MIDI requests.
//
// Problem: the HF Space has 1 CPU worker. If 10 users hit it simultaneously
// the server accepts every upload but pile-driving 10 sessions into the worker
// makes the UX terrible (everyone waits 30+ min with no idea where they stand)
// and risks tipping the Space over.
//
// Solution: every client inserts a row in `transcribe_queue` BEFORE uploading
// and polls to see its position. Only MAX_CONCURRENT rows can be in
// "uploading" or "processing" state at any time; everyone else stays in
// "waiting" with a visible queue position.
//
// Stale rows (>30 min, owner closed their tab) get ignored by the position
// math so abandoned tabs don't block the queue indefinitely.
// ============================================================================

import { createClient } from "@/lib/supabase/client";

const TABLE = "transcribe_queue";
// Two simultaneous transcriptions is what the HF Space CPU can handle without
// the per-job times exploding.
const MAX_CONCURRENT = 2;
const POLL_INTERVAL_MS = 2000;
// Hard ceiling so a wedged queue can't make the user wait forever.
const MAX_WAIT_MS = 30 * 60 * 1000;
// Anything older than this is treated as abandoned and ignored.
const STALE_AFTER_MS = 30 * 60 * 1000;

type ActiveStatus = "uploading" | "processing";
const ACTIVE_STATUSES: ActiveStatus[] = ["uploading", "processing"];

// Progress event shape — the upload modal renders this directly.
export type QueueWaitProgress = {
	positionInQueue: number; // 1-based, includes self
	activeCount: number; // currently in uploading/processing
	totalAhead: number; // people ahead of us still waiting/active (positionInQueue - 1)
};

export type QueueWaitCallback = (progress: QueueWaitProgress) => void;

// Promise-based sleep that respects an AbortSignal. Used between polls so the
// caller can cancel the entire wait by aborting (e.g. user closes the modal).
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

// Timestamp used to filter out abandoned rows in the position math.
function staleCutoffISO(): string {
	return new Date(Date.now() - STALE_AFTER_MS).toISOString();
}

/**
 * Inserts a queue row and waits until a slot is free. Returns the row id so
 * the caller can `markProcessing` and `releaseSlot` later. Throws on auth
 * failure, timeout, or abort.
 */
export async function waitForTranscribeSlot(
	fileName: string,
	onWait: QueueWaitCallback,
	signal?: AbortSignal,
): Promise<string> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	const userId = userData.user?.id;
	if (!userId) {
		throw new Error("Sign in to use audio transcription.");
	}

	// Take a number. `created_at` decides priority — the row's own value comes
	// back so we don't need a second query to know our place in line.
	const { data: row, error: insertErr } = await supabase
		.from(TABLE)
		.insert({ user_id: userId, file_name: fileName, status: "waiting" })
		.select("id, created_at")
		.single();

	if (insertErr || !row) {
		throw new Error(
			insertErr?.message ??
				"Could not join the transcription queue. The transcribe_queue table may not exist yet.",
		);
	}

	const rowId = row.id as string;
	const createdAt = row.created_at as string;
	const start = Date.now();

	// Wait until: (a) fewer than MAX_CONCURRENT active jobs AND (b) we are at
	// the head of the waiting line. Both are needed — without (b) two waiting
	// clients could both decide "active count is 1, I go" and race past the cap.
	try {
		while (true) {
			if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
			if (Date.now() - start > MAX_WAIT_MS) {
				throw new Error("Queue wait exceeded 30 min, the server may be down.");
			}

			const cutoff = staleCutoffISO();

			// Count active rows (uploading + processing), excluding stale entries.
			const { count: activeCount, error: activeErr } = await supabase
				.from(TABLE)
				.select("id", { count: "exact", head: true })
				.in("status", ACTIVE_STATUSES)
				.gte("created_at", cutoff);
			if (activeErr) throw new Error(activeErr.message);

			// Count rows older than us still in line (waiting + active).
			const { count: aheadCount, error: aheadErr } = await supabase
				.from(TABLE)
				.select("id", { count: "exact", head: true })
				.in("status", ["waiting", ...ACTIVE_STATUSES])
				.lt("created_at", createdAt)
				.gte("created_at", cutoff);
			if (aheadErr) throw new Error(aheadErr.message);

			const ahead = aheadCount ?? 0;
			const active = activeCount ?? 0;
			const position = ahead + 1;

			onWait({ positionInQueue: position, activeCount: active, totalAhead: ahead });

			// Two gates: (1) global cap not hit, (2) nobody older than us is still
			// waiting. Together they guarantee at most MAX_CONCURRENT active jobs
			// even with multiple clients polling at the same instant.
			if (active < MAX_CONCURRENT && ahead < MAX_CONCURRENT) {
				const { error: claimErr } = await supabase
					.from(TABLE)
					.update({ status: "uploading" })
					.eq("id", rowId)
					.eq("status", "waiting"); // ensure we don't double-claim
				if (claimErr) throw new Error(claimErr.message);
				return rowId;
			}

			await sleep(POLL_INTERVAL_MS, signal);
		}
	} catch (err) {
		// Best-effort cleanup so we don't hold a slot on error/abort.
		await releaseSlot(rowId).catch(() => {});
		throw err;
	}
}

/** Called once the Transkun server has accepted the upload and returned a job id. */
export async function markProcessing(rowId: string, transkunJobId: string): Promise<void> {
	const supabase = createClient();
	await supabase
		.from(TABLE)
		.update({ status: "processing", transkun_job_id: transkunJobId })
		.eq("id", rowId);
}

/** Always called at the end of a transcription (success, error, or cancel). */
export async function releaseSlot(rowId: string): Promise<void> {
	const supabase = createClient();
	await supabase.from(TABLE).delete().eq("id", rowId);
}
