"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, Instrument, instruments as BUILT_IN_INSTRUMENTS, DEFAULT_SOUNDFONT } from "../lib/types";
import { fetchDynamicSoundfonts } from "../lib/soundfonts";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

export type SoundfontOption = { key: string; name: string };

function percentToDb(percent: number): number {
	if (percent <= 0) return -Infinity;
	return 40 * Math.log10(percent / 100);
}

const VOLUME_STORAGE_KEY = "away:masterVolume";

function loadPersistedVolume(): number {
	if (typeof window === "undefined") return DEFAULT_VOLUME_PERCENT;
	const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
	if (raw === null) return DEFAULT_VOLUME_PERCENT;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return DEFAULT_VOLUME_PERCENT;
	return Math.max(0, Math.min(100, parsed));
}

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map());
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);

	const [currentSoundfont, setCurrentSoundfont] = useState<string>(DEFAULT_SOUNDFONT);
	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]);
	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);

	const [instruments, setInstruments] = useState<Record<string, Instrument>>(BUILT_IN_INSTRUMENTS);
	const instrumentsRef = useRef<Record<string, Instrument>>(BUILT_IN_INSTRUMENTS);
	useEffect(() => {
		instrumentsRef.current = instruments;
	}, [instruments]);

	useEffect(() => {
		fetchDynamicSoundfonts().then((dynamic) => {
			if (Object.keys(dynamic).length === 0) return;
			setInstruments((prev) => ({ ...prev, ...dynamic }));
		});
	}, []);

	const [masterVolume, setMasterVolumeState] = useState<number>(loadPersistedVolume);

	const setMasterVolume = useCallback((percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent));
		setMasterVolumeState(clamped);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
		}
		const node = masterVolumeNodeRef.current;
		if (!node) return;
		if (clamped === 0) {
			node.mute = true;
		} else {
			node.mute = false;
			node.volume.rampTo(percentToDb(clamped), 0.02);
		}
	}, []);

	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({
		key,
		name: val.name,
	}));

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

			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) {
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
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
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

	const loadSoundfont = useCallback((key: string): Promise<void> => {
		return new Promise((resolve, reject) => {
			const inst = instrumentsRef.current[key];
			if (!inst) return reject(new Error("Unknown soundfont"));
			if (samplersRef.current.has(key)) return resolve();
			if (!reverbRef.current) return reject(new Error("Audio not initialized"));

			setLoadingSoundfont(key);
			const sampler = createSampler(inst, () => {
				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
				setLoadingSoundfont((prev) => (prev === key ? null : prev));
				resolve();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(key, sampler);
		});
	}, []);

	const selectSoundfont = useCallback(
		async (key: string) => {
			if (!instrumentsRef.current[key]) return;
			if (!samplersRef.current.has(key)) {
				try {
					await loadSoundfont(key);
				} catch {
					return;
				}
			}
			const next = samplersRef.current.get(key);
			if (next) {
				samplerRef.current = next;
				setCurrentSoundfont(key);
			}
		},
		[loadSoundfont],
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

			const initialVolume = loadPersistedVolume();
			masterVolumeNodeRef.current = createMasterVolume(percentToDb(initialVolume));
			if (initialVolume === 0) masterVolumeNodeRef.current.mute = true;
			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);

			setLoadingSoundfont(DEFAULT_SOUNDFONT);
			const defaultInst = instrumentsRef.current[DEFAULT_SOUNDFONT];
			const sampler = createSampler(defaultInst, () => {
				setLoadedSoundfonts([DEFAULT_SOUNDFONT]);
				setLoadingSoundfont(null);
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler);
			samplerRef.current = sampler;

			connectMIDI();
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
		soundfonts,
		currentSoundfont,
		loadedSoundfonts,
		loadingSoundfont,
		selectSoundfont,
		masterVolume,
		setMasterVolume,
	};
};
