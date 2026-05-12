"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, Instrument, SoundfontCategory, instruments as BUILT_IN_INSTRUMENTS, DEFAULT_SOUNDFONT } from "../lib/types";
import { fetchDynamicSoundfonts } from "../lib/soundfonts";
import { getVisualizerColor, getKeySolidColor, PLAYER_COLORS_SOLID } from "@/lib/playerColors";
import { darkenHex, normalizeHex } from "@/lib/color";

const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

export type SoundfontOption = { key: string; name: string; category: SoundfontCategory };

function percentToDb(percent: number): number {
	if (percent <= 0) return -Infinity;
	return 40 * Math.log10(percent / 100);
}

const VOLUME_STORAGE_KEY = "away:masterVolume";
const NOTE_COLOR_HEX_STORAGE_KEY = "away:noteColorHex";
const LEGACY_WHITE_INDEX_KEY = "away:whiteNoteColorIndex";
const LEGACY_BLACK_INDEX_KEY = "away:blackNoteColorIndex";
const LEGACY_SINGLE_INDEX_KEY = "away:noteColorIndex";
const DEFAULT_NOTE_COLOR_HEX = PLAYER_COLORS_SOLID[0];

function loadPersistedVolume(): number {
	if (typeof window === "undefined") return DEFAULT_VOLUME_PERCENT;
	const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
	if (raw === null) return DEFAULT_VOLUME_PERCENT;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return DEFAULT_VOLUME_PERCENT;
	return Math.max(0, Math.min(100, parsed));
}

function loadPersistedNoteColor(): string {
	if (typeof window === "undefined") return DEFAULT_NOTE_COLOR_HEX;
	const raw = window.localStorage.getItem(NOTE_COLOR_HEX_STORAGE_KEY);
	if (raw) {
		const normalized = normalizeHex(raw);
		if (normalized) return normalized;
	}
	// Migrate from older index-based settings.
	const legacy =
		window.localStorage.getItem(LEGACY_WHITE_INDEX_KEY) ??
		window.localStorage.getItem(LEGACY_SINGLE_INDEX_KEY) ??
		window.localStorage.getItem(LEGACY_BLACK_INDEX_KEY);
	if (legacy !== null) {
		const idx = Number(legacy);
		if (Number.isInteger(idx) && idx >= 0 && idx < PLAYER_COLORS_SOLID.length) {
			return PLAYER_COLORS_SOLID[idx];
		}
	}
	return DEFAULT_NOTE_COLOR_HEX;
}

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map());
	const samplerGainsRef = useRef<Map<string, Tone.Gain>>(new Map());
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

	const midiTransposeRef = useRef(0);
	const velocityModeRef = useRef<"dynamic" | "fixed">("dynamic");
	const fixedVelocityRef = useRef(100);
	const sustainModeRef = useRef<"midi" | "always" | "off">("midi");

	const setMidiTranspose = useCallback((semitones: number) => {
		midiTransposeRef.current = Math.max(-24, Math.min(24, Math.round(semitones)));
	}, []);
	const setVelocityMode = useCallback((mode: "dynamic" | "fixed") => {
		velocityModeRef.current = mode;
	}, []);
	const setFixedVelocity = useCallback((v: number) => {
		fixedVelocityRef.current = Math.max(1, Math.min(127, Math.round(v)));
	}, []);
	const setSustainMode = useCallback((mode: "midi" | "always" | "off") => {
		sustainModeRef.current = mode;
		if (mode === "always") {
			isSustainOnRef.current = true;
		} else if (mode === "off") {
			isSustainOnRef.current = false;
			sustainedNotesRef.current.forEach((sustainedMidi) => {
				samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
			});
			sustainedNotesRef.current.clear();
		}
	}, []);

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

	const [noteColor, setNoteColorState] = useState<string>(loadPersistedNoteColor);
	const noteColorRef = useRef(noteColor);
	useEffect(() => {
		noteColorRef.current = noteColor;
	}, [noteColor]);

	const setNoteColor = useCallback((hex: string) => {
		const normalized = normalizeHex(hex);
		if (!normalized) return;
		setNoteColorState(normalized);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(NOTE_COLOR_HEX_STORAGE_KEY, normalized);
		}
	}, []);

	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({
		key,
		name: val.name,
		category: (val.category ?? "Other") as SoundfontCategory,
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
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorIndex?: number, noteColorHex?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Set();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;
			holders.add(playerId);
			sustainedNotesRef.current.delete(midi);

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			const isBlack = keyInfo?.isBlack ?? false;

			let solidColor: string;
			let visColor: string;
			if (noteColorHex) {
				solidColor = isBlack ? darkenHex(noteColorHex) : noteColorHex;
				visColor = isBlack ? darkenHex(noteColorHex) : noteColorHex;
			} else if (colorIndex !== undefined) {
				solidColor = getKeySolidColor(colorIndex, isBlack);
				visColor = getVisualizerColor(colorIndex, isBlack);
			} else {
				const base = noteColorRef.current;
				solidColor = isBlack ? darkenHex(base) : base;
				visColor = isBlack ? darkenHex(base) : base;
			}

			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			const normalizedVel = vel > 1 ? vel / 127 : vel;

			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) {
				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel);
			}

			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
				}

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: visColor,
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

			const sustainActive =
				sustainModeRef.current === "off"
					? false
					: sustainModeRef.current === "always"
						? true
						: isSustainOnRef.current;

			if (sustainActive) {
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

	const setSustain = useCallback((active: boolean) => {
		isSustainOnRef.current = active;
		if (!active) {
			sustainedNotesRef.current.forEach((sustainedMidi) => {
				samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
			});
			sustainedNotesRef.current.clear();
		}
	}, []);

	const setReverbWet = useCallback((percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent)) / 100;
		if (reverbRef.current) {
			try {
				reverbRef.current.wet.rampTo(clamped, 0.05);
			} catch {}
		}
	}, []);

	const loadSoundfont = useCallback((key: string): Promise<void> => {
		return new Promise((resolve, reject) => {
			const inst = instrumentsRef.current[key];
			if (!inst) return reject(new Error("Unknown soundfont"));
			if (samplersRef.current.has(key)) return resolve();
			if (!reverbRef.current) return reject(new Error("Audio not initialized"));

			setLoadingSoundfont(key);
			const gain = new Tone.Gain(0);
			gain.connect(reverbRef.current);
			const sampler = createSampler(inst, () => {
				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
				setLoadingSoundfont((prev) => (prev === key ? null : prev));
				resolve();
			});
			sampler.connect(gain);
			samplersRef.current.set(key, sampler);
			samplerGainsRef.current.set(key, gain);
		});
	}, []);

	const clearAllHeldKeys = () => {
		noteHoldersRef.current.clear();
		sustainedNotesRef.current.clear();
		document.querySelectorAll('[data-midi].active').forEach((el) => el.classList.remove('active'));
	};

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
			if (!next || !reverbRef.current) return;
			if (samplerRef.current === next) return;

			const old = samplerRef.current;
			if (old && old !== next) {
				try {
					old.releaseAll();
				} catch {}
			}

			samplerGainsRef.current.forEach((gain, k) => {
				const target = k === key ? 1 : 0;
				try {
					gain.gain.cancelScheduledValues(Tone.now());
					gain.gain.rampTo(target, 0.05);
				} catch {}
			});

			clearAllHeldKeys();

			samplerRef.current = next;
			setCurrentSoundfont(key);
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

								const transposed = note + midiTransposeRef.current;
								if (transposed < 0 || transposed > 127) return;

								if (command === 11 && note === 64) {
									if (sustainModeRef.current !== "midi") return;
									const pedalPressed = vel >= 64;
									isSustainOnRef.current = pedalPressed;
									if (!pedalPressed) {
										sustainedNotesRef.current.forEach((sustainedMidi) => {
											samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
										});
										sustainedNotesRef.current.clear();
									}
								} else if (command === 9 && vel > 0) {
									const finalVel = velocityModeRef.current === "fixed" ? fixedVelocityRef.current : vel;
									onPlay(transposed, finalVel);
								} else if (command === 8 || (command === 9 && vel === 0)) {
									onStop(transposed);
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
			const defaultGain = new Tone.Gain(1);
			defaultGain.connect(reverbRef.current);
			const sampler = createSampler(defaultInst, () => {
				setLoadedSoundfonts([DEFAULT_SOUNDFONT]);
				setLoadingSoundfont(null);
			});
			sampler.connect(defaultGain);
			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler);
			samplerGainsRef.current.set(DEFAULT_SOUNDFONT, defaultGain);
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
		noteColor,
		setNoteColor,
		setSustain,
		setReverbWet,
		setMidiTranspose,
		setVelocityMode,
		setFixedVelocity,
		setSustainMode,
	};
};
