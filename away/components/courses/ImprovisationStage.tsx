"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { CourseFallingNotes, type LaneItem } from "./CourseFallingNotes";
import type { ImprovisationStep } from "@/lib/courses/types";

const BACKING_COLOR = "#5571a8";
const ACCENT_COLOR = "#c75ad6";

interface ImprovisationStageProps {
	step: ImprovisationStep;
	playNote: (midi: number, velocity: number, playerId?: string, colorIndex?: number, noteColorHex?: string, soundfontKey?: string) => void;
	stopNote: (midi: number, playerId?: string, soundfontKey?: string) => void;
	unlockAudio: () => Promise<void>;
	// Fires whenever the backing track starts / stops, so the parent can keep the metronome in sync.
	onRunningChange?: (running: boolean) => void;
}

// Show falling chord blocks for a single look-ahead window
const LOOK_AHEAD_BEATS = 8;

export function ImprovisationStage({ step, playNote, stopNote, unlockAudio, onRunningChange }: ImprovisationStageProps) {
	const { bpm, beatsPerChord, chords } = step;
	const beatSec = 60 / bpm;
	const chordSec = beatSec * beatsPerChord;
	const totalLoopSec = chordSec * chords.length;

	const [running, setRunning] = useState(false);
	const [beatPos, setBeatPos] = useState(0); // total beats elapsed since play
	const [, forceTick] = useState(0);

	const startedAtRef = useRef<number | null>(null);
	const activeChordIdxRef = useRef(-1);
	const sustainedRef = useRef<Set<number>>(new Set());

	const stopAllChordTones = () => {
		sustainedRef.current.forEach((m) => stopNote(m, "course-backing"));
		sustainedRef.current.clear();
		activeChordIdxRef.current = -1;
	};

	useEffect(() => {
		return () => {
			stopAllChordTones();
			onRunningChange?.(false);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Notify parent whenever the backing track running state changes (used to sync the metronome).
	useEffect(() => {
		onRunningChange?.(running);
	}, [running, onRunningChange]);

	useEffect(() => {
		if (!running) return;
		let raf = 0;
		const tick = () => {
			raf = requestAnimationFrame(tick);
			if (startedAtRef.current === null) return;
			const elapsed = (performance.now() - startedAtRef.current) / 1000;
			const beats = elapsed / beatSec;
			setBeatPos(beats);

			const loopElapsed = elapsed % totalLoopSec;
			const idx = Math.floor(loopElapsed / chordSec) % chords.length;

			if (idx !== activeChordIdxRef.current) {
				// Stop the previous chord
				sustainedRef.current.forEach((m) => stopNote(m, "course-backing"));
				sustainedRef.current.clear();
				const nextChord = chords[idx];
				nextChord.midis.forEach((m) => {
					playNote(m, 70, "course-backing", undefined, BACKING_COLOR);
					sustainedRef.current.add(m);
				});
				activeChordIdxRef.current = idx;
			}
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [running, beatSec, totalLoopSec, chordSec, chords.length]);

	useEffect(() => {
		const id = window.setInterval(() => forceTick((x) => x + 1), 60);
		return () => window.clearInterval(id);
	}, []);

	const handlePlay = async () => {
		await unlockAudio();
		if (running) {
			stopAllChordTones();
			setRunning(false);
			startedAtRef.current = null;
			return;
		}
		startedAtRef.current = performance.now();
		setRunning(true);
	};

	const currentLoopBeat = beatPos % ((chordSec * chords.length) / beatSec);
	const currentChordIdx = Math.floor(currentLoopBeat / beatsPerChord) % chords.length;
	const beatInChord = currentLoopBeat - currentChordIdx * beatsPerChord;

	// Build lane items: render the upcoming chord blocks as falling bars
	const laneItems = useMemo<LaneItem[]>(() => {
		const items: LaneItem[] = [];
		if (!running) {
			// Show all 4 chords static
			chords.forEach((chord, idx) => {
				const top = idx / chords.length;
				chord.midis.forEach((m) => {
					items.push({
						midi: m,
						progress: 1 - top - 1 / chords.length,
						height: 0.9 / chords.length,
						color: BACKING_COLOR,
						glow: false,
						faded: false,
					});
				});
			});
			return items;
		}
		// Show LOOK_AHEAD_BEATS worth of chords moving down
		const totalAheadBeats = LOOK_AHEAD_BEATS;
		let cursor = 0;
		// Each chord lasts beatsPerChord; render the current and upcoming chords until we've covered totalAheadBeats
		const currentChordRemaining = beatsPerChord - beatInChord;
		// Current chord active
		items.push(
			...chords[currentChordIdx].midis.map((m) => ({
				midi: m,
				progress: 0,
				height: Math.min(0.4, (currentChordRemaining / totalAheadBeats) * 0.95),
				color: ACCENT_COLOR,
				glow: true,
				faded: false,
			})),
		);
		cursor += currentChordRemaining;
		let nextIdx = (currentChordIdx + 1) % chords.length;
		while (cursor < totalAheadBeats) {
			const len = Math.min(beatsPerChord, totalAheadBeats - cursor);
			const progressBottom = cursor / totalAheadBeats;
			const height = (len / totalAheadBeats) * 0.95;
			items.push(
				...chords[nextIdx].midis.map((m) => ({
					midi: m,
					progress: progressBottom,
					height,
					color: BACKING_COLOR,
					glow: false,
					faded: false,
				})),
			);
			cursor += len;
			nextIdx = (nextIdx + 1) % chords.length;
		}
		return items;
	}, [running, chords, currentChordIdx, beatInChord, beatsPerChord]);

	const currentChordName = chords[currentChordIdx]?.name ?? "—";

	return (
		<div className="relative h-full w-full">
			<CourseFallingNotes items={laneItems} />

			<div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 flex flex-col items-center gap-3">
				<div className="pointer-events-auto">
					<button onClick={handlePlay} className="transition-transform hover:scale-105">
						<DynamicLiquidGlass
							width={180}
							height={56}
							radius={28}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={running ? 0.16 : 0.04}
						>
							<span className="text-white text-base italic font-semibold tracking-wide">{running ? " Stop backing" : "  Start backing"}</span>
						</DynamicLiquidGlass>
					</button>
				</div>
				<div className="text-white text-3xl font-bold italic tracking-wide drop-shadow-[0_3px_12px_rgba(0,0,0,0.6)]">
					{running ? currentChordName : "—"}
				</div>
				<div className="text-white/60 text-xs italic tracking-wide uppercase">{step.bpm} BPM · C · Am · F · G</div>
			</div>
		</div>
	);
}
