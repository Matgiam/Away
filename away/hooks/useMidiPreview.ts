"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { parseMidi, type ParsedMidi } from "@/lib/practice/midiParser";

// Cache parsed MIDIs across hovers so we don't re-fetch+re-parse the same file
// every time the cursor leaves and returns. Keyed by URL.
const PARSED_CACHE = new Map<string, Promise<ParsedMidi>>();
const CACHE_LIMIT = 32;

async function fetchAndParse(url: string): Promise<ParsedMidi> {
	let pending = PARSED_CACHE.get(url);
	if (pending) return pending;

	pending = (async () => {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to fetch MIDI (${res.status})`);
		const buffer = await res.arrayBuffer();
		return parseMidi(buffer);
	})();

	if (PARSED_CACHE.size >= CACHE_LIMIT) {
		const firstKey = PARSED_CACHE.keys().next().value;
		if (firstKey) PARSED_CACHE.delete(firstKey);
	}
	PARSED_CACHE.set(url, pending);

	try {
		return await pending;
	} catch (e) {
		PARSED_CACHE.delete(url);
		throw e;
	}
}

type PreviewState = "idle" | "loading" | "playing" | "error";

type ActiveHandle = {
	notes: ReturnType<typeof scheduleNotes> | null;
	stopAllAt: number;
};

type ScheduledRelease = {
	midi: number;
	timeoutId: ReturnType<typeof setTimeout>;
};

function scheduleNotes(
	midi: ParsedMidi,
	startOffsetSec: number,
	maxDurationSec: number,
	playNote: (midi: number, vel: number, playerId: string) => void,
	stopNote: (midi: number, playerId: string) => void,
	playerId: string,
): { release: () => void } {
	const releases: ScheduledRelease[] = [];
	const startedAt = performance.now();
	const endByWallTime = startedAt + maxDurationSec * 1000;

	for (const note of midi.notes) {
		if (note.startSeconds < startOffsetSec) continue;
		if (note.startSeconds - startOffsetSec >= maxDurationSec) break;

		const startDelayMs = (note.startSeconds - startOffsetSec) * 1000;
		const noteEndMs = startDelayMs + note.durationSeconds * 1000;
		const cappedEndMs = Math.min(noteEndMs, maxDurationSec * 1000);

		const startTimer = setTimeout(() => {
			playNote(note.midi, note.velocity / 127, playerId);
			const releaseTimer = setTimeout(() => {
				stopNote(note.midi, playerId);
			}, Math.max(0, cappedEndMs - startDelayMs));
			releases.push({ midi: note.midi, timeoutId: releaseTimer });
		}, startDelayMs);
		releases.push({ midi: -1, timeoutId: startTimer });
	}

	let stopped = false;
	const release = () => {
		if (stopped) return;
		stopped = true;
		for (const r of releases) clearTimeout(r.timeoutId);
		// Hard release of every pitch that *might* still be ringing — cheap and safe.
		for (const note of midi.notes) {
			if (note.startSeconds < startOffsetSec) continue;
			if (note.startSeconds - startOffsetSec >= maxDurationSec) break;
			try {
				stopNote(note.midi, playerId);
			} catch {}
		}
	};

	// Auto-release at end-of-window in case the consumer forgets.
	setTimeout(release, Math.max(0, endByWallTime - performance.now()) + 50);

	return { release };
}

export interface PreviewOptions {
	maxDurationSec?: number;
	startOffsetSec?: number;
	playerId?: string;
}

export function useMidiPreview() {
	const { playNote, stopNote, unlockAudio } = useAudioEngineContext();
	const [state, setState] = useState<PreviewState>("idle");
	const [activeUrl, setActiveUrl] = useState<string | null>(null);
	const activeRef = useRef<ActiveHandle | null>(null);
	const tokenRef = useRef(0);

	const stop = useCallback(() => {
		const cur = activeRef.current;
		if (cur?.notes) {
			cur.notes.release();
		}
		activeRef.current = null;
		setActiveUrl(null);
		setState("idle");
	}, []);

	const play = useCallback(
		async (url: string, opts: PreviewOptions = {}) => {
			const maxDurationSec = opts.maxDurationSec ?? 3;
			const startOffsetSec = opts.startOffsetSec ?? 0;
			const playerId = opts.playerId ?? "preview";

			// Cancel anything currently playing.
			if (activeRef.current?.notes) activeRef.current.notes.release();
			activeRef.current = null;

			const token = ++tokenRef.current;
			setState("loading");
			setActiveUrl(url);

			try {
				await unlockAudio();
				const parsed = await fetchAndParse(url);
				if (tokenRef.current !== token) return; // hovered something else mid-flight

				// If the song doesn't start at 0, jump forward to the first note so the
				// preview is never silent for a hover.
				const firstNoteAt = parsed.notes.length > 0 ? parsed.notes[0].startSeconds : 0;
				const offset = Math.max(startOffsetSec, firstNoteAt);

				const handle = scheduleNotes(parsed, offset, maxDurationSec, playNote, stopNote, playerId);
				activeRef.current = { notes: handle, stopAllAt: performance.now() + maxDurationSec * 1000 };
				setState("playing");

				// Auto-clean state when the window ends.
				setTimeout(() => {
					if (tokenRef.current === token) {
						activeRef.current = null;
						setActiveUrl(null);
						setState("idle");
					}
				}, maxDurationSec * 1000 + 100);
			} catch {
				if (tokenRef.current === token) {
					activeRef.current = null;
					setActiveUrl(null);
					setState("error");
				}
			}
		},
		[playNote, stopNote, unlockAudio],
	);

	// Ensure all scheduled notes are cancelled when the component unmounts.
	useEffect(() => {
		return () => {
			if (activeRef.current?.notes) activeRef.current.notes.release();
			activeRef.current = null;
		};
	}, []);

	return { play, stop, state, activeUrl };
}
