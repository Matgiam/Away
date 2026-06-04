// ============================================================================
// useBackgroundTranscription.ts
// ----------------------------------------------------------------------------
// Owns the lifecycle of a single in-flight audio→MIDI transcription so the
// user can close the upload modal and watch progress as a tiny floating
// toast instead.
//
// The state machine: idle → running (with live progress) → done | error.
// `done` and `error` are *terminal* — the toast sits there until the user
// either acts on it (opens the finalize modal) or dismisses it. Starting
// a new transcription while another is running aborts the old one and
// replaces the toast.
// ============================================================================

"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAudioToMidi, type TranscribeEngine } from "@/lib/practice/transcribe";

// Holds the state of a single in-flight audio→MIDI transcription so the
// caller (PracticeMenu) can close its big upload modal and surface a small
// toast instead. When the transcription finishes the result sits in `done`
// state until the user either opens the finalize modal or dismisses it.

// Discriminated union — each phase carries only the fields it needs.
export type BackgroundTranscribeState =
	| { phase: "idle" }
	| {
			phase: "running";
			fileName: string;
			engine: TranscribeEngine;
			progress: number;
			message: string;
	  }
	| {
			phase: "done";
			fileName: string;
			engine: TranscribeEngine;
			midiFile: File;
			midiBuffer: ArrayBuffer;
			// The user's original audio. Kept around so the finalize step can save
			// it alongside the MIDI for sync playback in practice mode.
			audioFile: File;
	  }
	| {
			phase: "error";
			fileName: string;
			engine: TranscribeEngine;
			error: string;
	  };

// Public API the toast / modal use to drive the state.
export type BackgroundTranscribeControls = {
	state: BackgroundTranscribeState;
	start: (file: File, engine: TranscribeEngine) => void;
	dismiss: () => void;
	cancel: () => void;
};

export function useBackgroundTranscription(): BackgroundTranscribeControls {
	const [state, setState] = useState<BackgroundTranscribeState>({ phase: "idle" });
	// Single-controller pattern — one active transcription at a time.
	const abortRef = useRef<AbortController | null>(null);

	const start = useCallback((file: File, engine: TranscribeEngine) => {
		// Abort any prior in-flight task — we only track one transcription at a
		// time. The previous toast (if any) gets replaced.
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setState({
			phase: "running",
			fileName: file.name,
			engine,
			progress: 0,
			message: "Starting…",
		});

		// Self-contained async block so we can return the controls synchronously.
		(async () => {
			try {
				const midiBuffer = await transcribeAudioToMidi(
					file,
					(event) => {
						// Drop late progress updates if the user cancelled or another
						// task has taken over.
						if (controller.signal.aborted) return;
						// Defensive merge: only apply when we're still on the same
						// file (a rapid start→start could leave one update in flight).
						setState((prev) =>
							prev.phase === "running" && prev.fileName === file.name
								? { ...prev, progress: event.progress, message: event.message }
								: prev,
						);
					},
					controller.signal,
					engine,
				);

				if (controller.signal.aborted) return;

				// Build a File from the MIDI bytes so the downstream finalize modal
				// can treat it identically to a user-picked MIDI upload.
				const midiName = file.name.replace(/\.[^.]+$/, "") + ".mid";
				const midiFile = new File([midiBuffer], midiName, { type: "audio/midi" });
				setState({
					phase: "done",
					fileName: file.name,
					engine,
					midiFile,
					midiBuffer,
					// Stash the source audio so the finalize step can persist it for
					// sync playback. The File object holds bytes in memory, so it
					// stays valid until the state moves off "done".
					audioFile: file,
				});
			} catch (err) {
				if (controller.signal.aborted) return;
				setState({
					phase: "error",
					fileName: file.name,
					engine,
					error: err instanceof Error ? err.message : "Transcription failed",
				});
			} finally {
				// Only clear the ref if it's still pointing at us — a newer start
				// may have already taken over.
				if (abortRef.current === controller) {
					abortRef.current = null;
				}
			}
		})();
	}, []);

	const dismiss = useCallback(() => {
		// Only clears terminal states (done/error). Running state is left alone so
		// a stray dismiss can't kill an active transcription — use cancel() for that.
		setState((prev) => (prev.phase === "running" ? prev : { phase: "idle" }));
	}, []);

	const cancel = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setState({ phase: "idle" });
	}, []);

	return { state, start, dismiss, cancel };
}
