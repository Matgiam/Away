// ============================================================================
// courses/ImprovisationStage.tsx
// ----------------------------------------------------------------------------
// Stage used by improvisation steps. Loops a backing chord progression at
// the step's BPM and highlights the scale notes the user is free to play
// over. Suppresses the global metronome while running (it owns its own
// click clock so the two don't double-tick out of phase).
// ============================================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { CourseFallingNotes, type LaneItem } from "./CourseFallingNotes";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import type { ImprovisationStep } from "@/lib/courses/types";

const BACKING_COLOR = "#5571a8";
const ACCENT_COLOR = "#c75ad6";

interface ImprovisationStageProps {
	step: ImprovisationStep;
	playNote: (midi: number, velocity: number, playerId?: string, colorIndex?: number, noteColorHex?: string, soundfontKey?: string) => void;
	stopNote: (midi: number, playerId?: string, soundfontKey?: string) => void;
	unlockAudio: () => Promise<void>;
	// Optional — fires whenever the backing track starts / stops, kept for backwards compat.
	onRunningChange?: (running: boolean) => void;
}

// Show falling chord blocks for a single look-ahead window
const LOOK_AHEAD_BEATS = 8;

export function ImprovisationStage({
	step,
	playNote,
	stopNote,
	unlockAudio,
	onRunningChange,
}: ImprovisationStageProps) {
	const { bpm, beatsPerChord, chords } = step;
	const beatSec = 60 / bpm;
	const chordSec = beatSec * beatsPerChord;
	const totalLoopSec = chordSec * chords.length;

	const { settings, suppressMetronome, resumeMetronome } = useAudioEngineContext();

	const [running, setRunning] = useState(false);
	const [beatPos, setBeatPos] = useState(0); // total beats elapsed since play
	const [, forceTick] = useState(0);

	const startedAtRef = useRef<number | null>(null);
	const activeChordIdxRef = useRef(-1);
	const sustainedRef = useRef<Set<number>>(new Set());
	// Click sound generator — same clock as chord changes, so the two never drift.
	const clickCtxRef = useRef<AudioContext | null>(null);
	const lastClickBeatRef = useRef<number>(-1);
	const metronomeVolumeRef = useRef(settings.metronomeVolume);
	const metronomeEnabledRef = useRef(settings.metronomeEnabled);
	useEffect(() => {
		metronomeVolumeRef.current = settings.metronomeVolume;
	}, [settings.metronomeVolume]);
	useEffect(() => {
		metronomeEnabledRef.current = settings.metronomeEnabled;
	}, [settings.metronomeEnabled]);

	// Take ownership of the metronome while this stage is mounted — keeps the global
	// metronome silent so it doesn't drift against the chord-change clock.
	useEffect(() => {
		suppressMetronome();
		return () => resumeMetronome();
	}, [suppressMetronome, resumeMetronome]);

	const stopAllChordTones = () => {
		sustainedRef.current.forEach((m) => stopNote(m, "course-backing"));
		sustainedRef.current.clear();
		activeChordIdxRef.current = -1;
		lastClickBeatRef.current = -1;
	};

	const playClick = (isDownbeat: boolean) => {
		if (typeof window === "undefined") return;
		if (!clickCtxRef.current || clickCtxRef.current.state === "closed") {
			const Ctor: typeof AudioContext =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) return;
			clickCtxRef.current = new Ctor();
		}
		const ctx = clickCtxRef.current;
		if (ctx.state === "suspended") ctx.resume().catch(() => {});

		const peakGain = Math.max(0, Math.min(1, metronomeVolumeRef.current / 100));
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = isDownbeat ? 1500 : 900;
		const t = ctx.currentTime;
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(
			Math.max(0.0002, peakGain * (isDownbeat ? 1 : 0.7)),
			t + 0.001,
		);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(t);
		osc.stop(t + 0.08);
	};

	useEffect(() => {
		return () => {
			stopAllChordTones();
			onRunningChange?.(false);
			clickCtxRef.current?.close().catch(() => {});
			clickCtxRef.current = null;
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

			// Metronome clicks — share the same elapsed-time clock as the chord scheduler, so
			// every click lands on the same beat boundary as the backing notes. Respects the
			// user's metronome on/off toggle in the navigation, so they can silence the click
			// mid-improv without stopping the backing track.
			const beatIdx = Math.floor(beats);
			if (beatIdx !== lastClickBeatRef.current && beatIdx >= 0) {
				lastClickBeatRef.current = beatIdx;
				if (metronomeEnabledRef.current) {
					const isDownbeat = beatIdx % beatsPerChord === 0;
					playClick(isDownbeat);
				}
			}

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

			{/*
			 * Button sits below the CourseStepCard, not at top-4. With images
			 * now embedded in every step the card grew from 220 → 320px and
			 * its z-30 box visually covers the old top-4 position — clicks
			 * were landing on the card panel (pointer-events-auto) instead
			 * of the button below.
			 *
			 * Card layout:
			 *   28px (top-7 of card container)
			 * + 30px (course-title row above card)
			 * + 320px (cardHeight when image is present)
			 * = 378px from screen top to card bottom
			 *
			 * Stage container starts at pt-72 = 288px → button at top-24 (96px)
			 * lands at 288 + 96 = 384px — just below the card.
			 */}
			<div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 flex flex-col items-center gap-3">
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
