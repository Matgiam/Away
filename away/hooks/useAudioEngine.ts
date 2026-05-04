"use client";

import { useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb } from "../lib/audio";
import { VisNote, PianoKey } from "../lib/types";

export const useAudioEngine = (
	pianoKeys: PianoKey[],
	setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>
) => {
	const audioStartedRef = useRef(false);
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const activeNotesRef = useRef<Record<number, boolean>>({});
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);

	const playNote = useCallback(
		(midi: number, vel: number = 0.7) => {
			if (!audioStartedRef.current || !samplerRef.current || activeNotesRef.current[midi]) return;

			activeNotesRef.current[midi] = true;
			sustainedNotesRef.current.delete(midi);

			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.add("active");

			samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), vel);

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (keyInfo.isBlack) {
					w = whiteKeyWidth * 0.55;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth * 0.75;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth + whiteKeyWidth * 0.125;
				}

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack: keyInfo.isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: keyInfo.color,
					x,
					w,
				};

				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines]
	);

	const stopNote = useCallback((midi: number) => {
		if (!samplerRef.current || !activeNotesRef.current[midi]) return;

		activeNotesRef.current[midi] = false;
		const keyEl = document.querySelector(`[data-midi="${midi}"]`);
		keyEl?.classList.remove("active");

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null);
		if (pendingNote) pendingNote.endTime = performance.now();

		if (isSustainOnRef.current) {
			sustainedNotesRef.current.add(midi);
		} else {
			samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate());
		}
	}, []);

	const connectMIDI = useCallback(() => {
		const nav = navigator as any;
		nav.requestMIDIAccess?.().then((m: any) => {
			m.inputs.forEach((i: any) => {
				i.onmidimessage = (msg: any) => {
					const [cmd, note, vel] = msg.data;
					const command = cmd >> 4;
					if (command === 11 && note === 64) {
						const pedalPressed = vel >= 64;
						isSustainOnRef.current = pedalPressed;
						if (!pedalPressed) {
							sustainedNotesRef.current.forEach((sustainedMidi) => {
								samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
							});
							sustainedNotesRef.current.clear();
						}
					} else if (command === 9 && vel > 0) playNote(note, vel / 127);
					else if (command === 8 || (command === 9 && vel === 0)) stopNote(note);
				};
			});
		});
	}, [playNote, stopNote]);

	const loadInitialInstrument = useCallback((instKey: string) => {
		samplerRef.current = createSampler(instKey, () => {
			connectMIDI();
		}).connect(reverbRef.current!);
	}, [connectMIDI]);

	const initAudio = useCallback(async () => {
		await initAudioContext();
		reverbRef.current = createReverb(0.2);
		Tone.Destination.volume.value = -5;
		loadInitialInstrument("grand_piano");
	}, [loadInitialInstrument]);

	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	useEffect(() => {
		initAudio();
	}, [initAudio]);

	return { playNote, stopNote, unlockAudio };
};
