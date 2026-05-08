"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb } from "../lib/audio";
import { VisNote, PianoKey } from "../lib/types";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

const SELF = "self";

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);

	// midi -> Set of playerIds currently holding the note
	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);

	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	const playNote = useCallback(
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorOverride?: string, solidColorOverride?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Set();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;
			holders.add(playerId);
			sustainedNotesRef.current.delete(midi);

			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				const solidColor = solidColorOverride ?? PLAYER_COLORS_SOLID[0];
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			const normalizedVel = vel > 1 ? vel / 127 : vel;

			if (audioStartedRef.current && samplerRef.current) {
				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel);
			}

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (keyInfo.isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth * 0.75;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth + whiteKeyWidth * 0.125;
				}

				const noteColor = colorOverride ?? keyInfo.color;

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack: keyInfo.isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: noteColor,
					x,
					w,
					playerId,
				};

				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines],
	);

	const stopNote = useCallback((midi: number, playerId: string = SELF) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return;
		holders.delete(playerId);

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		if (holders.size === 0) {
			noteHoldersRef.current.delete(midi);
			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.remove("active");

			if (isSustainOnRef.current) {
				sustainedNotesRef.current.add(midi);
			} else if (samplerRef.current) {
				samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate());
			}
		}
	}, []);

	const releaseAllForPlayer = useCallback(
		(playerId: string) => {
			const midis: number[] = [];
			noteHoldersRef.current.forEach((holders, midi) => {
				if (holders.has(playerId)) midis.push(midi);
			});
			midis.forEach((m) => stopNote(m, playerId));
		},
		[stopNote],
	);

	const connectMIDI = useCallback(
		(onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v), onStop: (note: number) => void = (n) => stopNote(n)) => {
			const nav = navigator as any;
			if (!nav.requestMIDIAccess) {
				setMidiError("Web MIDI is not enabled in this browser. In Brave, open brave://settings/content/midiSysex and enable MIDI for this site.");
				setMidiDevices([]);
				return;
			}
			nav
				.requestMIDIAccess({ sysex: false })
				.then((m: any) => {
					setMidiError(null);
					const refresh = () => {
						const names: string[] = [];
						m.inputs.forEach((i: any) => {
							names.push(i.name || "Unknown MIDI device");
							i.onmidimessage = (msg: any) => {
								unlockAudio();
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
								} else if (command === 9 && vel > 0) {
									onPlay(note, vel);
								} else if (command === 8 || (command === 9 && vel === 0)) {
									onStop(note);
								}
							};
						});
						setMidiDevices(names);
					};
					refresh();
					m.onstatechange = refresh;
				})
				.catch((err: any) => {
					setMidiError("MIDI access denied: " + (err?.message || String(err)));
					setMidiDevices([]);
				});
		},
		[playNote, stopNote, unlockAudio],
	);

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const init = async () => {
			await initAudioContext();
			reverbRef.current = createReverb(0.2);
			Tone.Destination.volume.value = -5;

			const sampler = createSampler("grand_piano", () => {
				connectMIDI();
			});
			samplerRef.current = sampler.connect(reverbRef.current);
		};
		init();
	}, [connectMIDI]);

	return {
		playNote,
		stopNote,
		unlockAudio,
		connectMIDI,
		releaseAllForPlayer,
		midiDevices,
		midiError,
	};
};
