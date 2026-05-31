"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAudioToMidi, type TranscribeEngine } from "@/lib/practice/transcribe";

// Holds the state of a single in-flight audio→MIDI transcription so the
// caller (PracticeMenu) can close its big upload modal and surface a small
// toast instead. When the transcription finishes the result sits in `done`
// state until the user either opens the finalize modal or dismisses it.

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
	  }
	| {
			phase: "error";
			fileName: string;
			engine: TranscribeEngine;
			error: string;
	  };

export type BackgroundTranscribeControls = {
	state: BackgroundTranscribeState;
	start: (file: File, engine: TranscribeEngine) => void;
	dismiss: () => void;
	cancel: () => void;
};

export function useBackgroundTranscription(): BackgroundTranscribeControls {
	const [state, setState] = useState<BackgroundTranscribeState>({ phase: "idle" });
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

		(async () => {
			try {
				const midiBuffer = await transcribeAudioToMidi(
					file,
					(event) => {
						// Drop late progress updates if the user cancelled or another
						// task has taken over.
						if (controller.signal.aborted) return;
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

				const midiName = file.name.replace(/\.[^.]+$/, "") + ".mid";
				const midiFile = new File([midiBuffer], midiName, { type: "audio/midi" });
				setState({
					phase: "done",
					fileName: file.name,
					engine,
					midiFile,
					midiBuffer,
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
