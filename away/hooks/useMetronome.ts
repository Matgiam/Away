// ============================================================================
// useMetronome.ts
// ----------------------------------------------------------------------------
// Web Audio metronome. Schedules sine-wave clicks at the requested BPM with
// a look-ahead scheduler so the click timing doesn't drift even if the main
// thread is busy laying out the falling-notes view.
//
// Two pitches:
//   * Downbeat (beat 1 of the bar): 1500 Hz, full volume.
//   * Other beats:                  900 Hz, 70% volume.
//
// The hook owns its own AudioContext (separate from the synth's) so the
// metronome stays accurate even when the synth's worklet is busy.
// ============================================================================

"use client";

import { useEffect, useRef } from "react";

interface MetronomeOptions {
	enabled: boolean;
	bpm: number;
	beatsPerBar: number;
	// 0-100 (matches the slider scale used by master volume)
	volume?: number;
}

// Stable Web-Audio metronome. Uses a look-ahead scheduler so clicks don't drift
// even if the main thread stalls. Pitches: 1000 Hz on beat 1, 700 Hz otherwise.
export function useMetronome({ enabled, bpm, beatsPerBar, volume = 60 }: MetronomeOptions) {
	// Single AudioContext lives across enable/disable cycles to avoid the
	// "user gesture required" delay every time the user re-enables.
	const ctxRef = useRef<AudioContext | null>(null);

	useEffect(() => {
		if (!enabled) return;
		if (typeof window === "undefined") return;

		// Lazy-create / re-use a single AudioContext.
		if (!ctxRef.current || ctxRef.current.state === "closed") {
			const Ctor: typeof AudioContext =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) return;
			ctxRef.current = new Ctor();
		}
		const ctx = ctxRef.current;
		// Resume in case the user paused / the context got suspended.
		if (ctx.state === "suspended") {
			ctx.resume().catch(() => {});
		}

		// Clamp inputs so a bad value can't crash the audio thread.
		const safeBpm = Math.max(20, Math.min(300, bpm));
		const safeBeats = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
		const peakGain = Math.max(0, Math.min(1, volume / 100));

		const secondsPerBeat = 60 / safeBpm;
		let currentBeat = 0;
		// Small head-start so the first click doesn't land right on the user's
		// finger press (which would feel "behind").
		let nextNoteTime = ctx.currentTime + 0.12;

		// Classic look-ahead scheduler: scheduleAheadTime is how far into the
		// future we queue audio events; lookaheadMs is how often we check.
		const scheduleAheadTime = 0.12;
		const lookaheadMs = 25;

		// Build a quick attack-decay envelope for one click. Using
		// exponentialRampToValueAtTime gives a softer perceptual transient than
		// `setValueAtTime` jumps.
		const scheduleClick = (time: number, isDownbeat: boolean) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = isDownbeat ? 1500 : 900;
			const attack = 0.001;
			const decay = 0.06;
			gain.gain.setValueAtTime(0.0001, time);
			gain.gain.exponentialRampToValueAtTime(
				Math.max(0.0002, peakGain * (isDownbeat ? 1 : 0.7)),
				time + attack,
			);
			gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(time);
			// Add a tiny tail so the exp-ramp finishes before the oscillator
			// stops — otherwise we hear a hard click at the cut.
			osc.stop(time + decay + 0.01);
		};

		// Tick: queue every beat that lands inside our look-ahead window.
		const tick = () => {
			const ahead = ctx.currentTime + scheduleAheadTime;
			while (nextNoteTime < ahead) {
				const isDownbeat = currentBeat % safeBeats === 0;
				scheduleClick(nextNoteTime, isDownbeat);
				nextNoteTime += secondsPerBeat;
				currentBeat++;
			}
		};

		const id = window.setInterval(tick, lookaheadMs);
		tick(); // schedule the first batch immediately so the first beat isn't late

		return () => {
			window.clearInterval(id);
		};
	}, [enabled, bpm, beatsPerBar, volume]);

	// Final cleanup on unmount — close the context entirely so we don't leak
	// audio resources across page navigations.
	useEffect(() => {
		return () => {
			ctxRef.current?.close().catch(() => {});
			ctxRef.current = null;
		};
	}, []);
}
