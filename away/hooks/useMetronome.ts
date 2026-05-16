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
		if (ctx.state === "suspended") {
			ctx.resume().catch(() => {});
		}

		const safeBpm = Math.max(20, Math.min(300, bpm));
		const safeBeats = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
		const peakGain = Math.max(0, Math.min(1, volume / 100));

		const secondsPerBeat = 60 / safeBpm;
		let currentBeat = 0;
		let nextNoteTime = ctx.currentTime + 0.12;

		const scheduleAheadTime = 0.12;
		const lookaheadMs = 25;

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
			osc.stop(time + decay + 0.01);
		};

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
		tick();

		return () => {
			window.clearInterval(id);
		};
	}, [enabled, bpm, beatsPerBar, volume]);

	useEffect(() => {
		return () => {
			ctxRef.current?.close().catch(() => {});
			ctxRef.current = null;
		};
	}, []);
}
