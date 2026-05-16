"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FallingNotes } from "@/components/practice/FallingNotes";
import type { ParsedNote } from "@/lib/practice/midiParser";

const COLOR_DEMO = "#a76cd1";
const COLOR_LEFT = "#5571a8";
const EMPTY_SET: ReadonlySet<number> = new Set();
const LOOK_AHEAD_SECONDS = 3;

interface CourseDemoStageProps {
	// The notes to play (already in ParsedNote format — synthesised or from MIDI)
	notes: ParsedNote[];
	// When true, the demo plays from the beginning; setting to false stops it
	running: boolean;
	// Audio engine handles
	playNote: (
		midi: number,
		velocity: number,
		playerId?: string,
		colorIndex?: number,
		noteColorHex?: string,
		soundfontKey?: string,
	) => void;
	stopNote: (midi: number, playerId?: string, soundfontKey?: string) => void;
	// Fires once playhead exceeds the last note's end
	onComplete: () => void;
	// Resets external "running" when complete — also used to externally restart
	onRunningChange?: (running: boolean) => void;
}

export function CourseDemoStage({
	notes,
	running,
	playNote,
	stopNote,
	onComplete,
	onRunningChange,
}: CourseDemoStageProps) {
	const [currentTime, setCurrentTime] = useState(0);

	const playheadRef = useRef(0);
	const nextNoteIndexRef = useRef(0);
	const activeNotesRef = useRef<Map<number, number>>(new Map());
	const completedRef = useRef(false);

	const totalDuration = useMemo(() => {
		if (notes.length === 0) return 0;
		return notes.reduce((max, n) => Math.max(max, n.startSeconds + n.durationSeconds), 0) + 0.4;
	}, [notes]);

	const releaseAll = () => {
		activeNotesRef.current.forEach((_end, midi) => stopNote(midi, "course-demo"));
		activeNotesRef.current.clear();
	};

	// Reset when the source notes change or when running toggles back on
	useEffect(() => {
		releaseAll();
		playheadRef.current = 0;
		nextNoteIndexRef.current = 0;
		completedRef.current = false;
		setCurrentTime(0);
		return () => {
			releaseAll();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [notes]);

	useEffect(() => {
		if (!running) {
			releaseAll();
			return;
		}
		if (notes.length === 0) return;

		let raf = 0;
		let lastFrame = 0;

		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);

			const last = lastFrame || now;
			const dt = (now - last) / 1000;
			lastFrame = now;

			playheadRef.current += dt;
			const t = playheadRef.current;

			// Schedule note-ons
			while (nextNoteIndexRef.current < notes.length) {
				const note = notes[nextNoteIndexRef.current];
				if (note.startSeconds > t) break;
				nextNoteIndexRef.current++;
				// Stop any duplicate that is still ringing
				if (activeNotesRef.current.has(note.midi)) {
					stopNote(note.midi, "course-demo");
					activeNotesRef.current.delete(note.midi);
				}
				playNote(note.midi, note.velocity, "course-demo", undefined, COLOR_DEMO);
				activeNotesRef.current.set(note.midi, note.startSeconds + note.durationSeconds);
			}
			// Release notes that have ended
			activeNotesRef.current.forEach((end, midi) => {
				if (end <= t) {
					stopNote(midi, "course-demo");
					activeNotesRef.current.delete(midi);
				}
			});

			setCurrentTime(t);

			if (!completedRef.current && t >= totalDuration) {
				completedRef.current = true;
				releaseAll();
				cancelAnimationFrame(raf);
				onRunningChange?.(false);
				onComplete();
			}
		};

		raf = requestAnimationFrame((ts) => {
			lastFrame = ts;
			tick(ts);
		});

		return () => {
			cancelAnimationFrame(raf);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [running, notes, totalDuration]);

	const visibleNotes = useMemo<ParsedNote[]>(() => {
		const t = currentTime;
		const horizon = t + LOOK_AHEAD_SECONDS;
		return notes.filter((n) => {
			const end = n.startSeconds + n.durationSeconds;
			if (end < t - 0.2) return false;
			if (n.startSeconds > horizon) return false;
			return true;
		});
	}, [notes, currentTime]);

	return (
		<FallingNotes
			notes={visibleNotes}
			currentTime={currentTime}
			lookAheadSeconds={LOOK_AHEAD_SECONDS}
			handForNote={() => "right"}
			colors={{ right: COLOR_DEMO, left: COLOR_LEFT }}
			gateMidis={EMPTY_SET}
			hitMidis={EMPTY_SET}
			gateStartTime={null}
		/>
	);
}

// Build a list of practice-style ParsedNotes from the `demoNotes` array of a course step.
// Each entry can be a single midi or an array of midis (chord).
export function buildSyntheticDemoNotes(
	items: Array<number | number[]>,
	options?: { noteDurationMs?: number; gapMs?: number; chordDurationMs?: number },
): ParsedNote[] {
	const noteDurMs = options?.noteDurationMs ?? 600;
	const gapMs = options?.gapMs ?? 200;
	const chordDurMs = options?.chordDurationMs ?? Math.max(noteDurMs, 950);
	const result: ParsedNote[] = [];

	// Lead-in so the first note has time to fall from the top
	let cursorMs = (LOOK_AHEAD_SECONDS + 0.3) * 1000;

	items.forEach((item) => {
		const midis = Array.isArray(item) ? item : [item];
		const durMs = midis.length > 1 ? chordDurMs : noteDurMs;
		midis.forEach((m) => {
			result.push({
				midi: m,
				velocity: 92,
				startSeconds: cursorMs / 1000,
				durationSeconds: durMs / 1000,
				track: 0,
				channel: 0,
			});
		});
		cursorMs += durMs + gapMs;
	});

	return result;
}

export { LOOK_AHEAD_SECONDS as DEMO_LOOK_AHEAD_SECONDS };
