"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, Instrument, SoundfontCategory, instruments as BUILT_IN_INSTRUMENTS, DEFAULT_SOUNDFONT } from "../lib/types";
import { fetchDynamicSoundfonts } from "../lib/soundfonts";
import { SpessaSynthEngine, SELF_CHANNEL } from "../lib/spessaSynthEngine";
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
const SOUNDFONT_STORAGE_KEY = "away:selectedSoundfont";
const DEFAULT_NOTE_COLOR_HEX = PLAYER_COLORS_SOLID[0];

function loadPersistedSoundfont(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(SOUNDFONT_STORAGE_KEY);
	} catch {
		return null;
	}
}

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
	const engineRef = useRef<SpessaSynthEngine | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	const noteHoldersRef = useRef<Map<number, Map<string, string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const peerSustainRef = useRef<Map<string, boolean>>(new Map());
	const peerSustainedNotesRef = useRef<Map<string, Set<number>>>(new Map());
	const currentSoundfontRef = useRef<string>(DEFAULT_SOUNDFONT);
	const loadSoundfontRef = useRef<((key: string) => Promise<void>) | null>(null);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);
	const [localPressedMidis, setLocalPressedMidis] = useState<number[]>([]);
	const [localSustainedMidis, setLocalSustainedMidis] = useState<number[]>([]);

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
			engineRef.current?.setSustain(SELF_CHANNEL, true);
		} else if (mode === "off") {
			isSustainOnRef.current = false;
			engineRef.current?.setSustain(SELF_CHANNEL, false);
			sustainedNotesRef.current.clear();
			setLocalSustainedMidis([]);
		}
	}, []);

	const [currentSoundfont, setCurrentSoundfontState] = useState<string>(DEFAULT_SOUNDFONT);
	const setCurrentSoundfont = useCallback((key: string) => {
		currentSoundfontRef.current = key;
		setCurrentSoundfontState(key);
		if (typeof window !== "undefined") {
			try {
				window.localStorage.setItem(SOUNDFONT_STORAGE_KEY, key);
			} catch {}
		}
	}, []);
	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]);
	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);

	const [instruments, setInstruments] = useState<Record<string, Instrument>>(BUILT_IN_INSTRUMENTS);
	const instrumentsRef = useRef<Record<string, Instrument>>(BUILT_IN_INSTRUMENTS);
	useEffect(() => {
		instrumentsRef.current = instruments;
	}, [instruments]);

	// The catalog is fetched once during the init effect below, which also needs
	// it to pick the default font's URL. No second fetch here.

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

	const localHeldMidis = useMemo(() => {
		if (localSustainedMidis.length === 0) return localPressedMidis;
		const merged = new Set<number>(localPressedMidis);
		localSustainedMidis.forEach((m) => merged.add(m));
		return Array.from(merged).sort((a, b) => a - b);
	}, [localPressedMidis, localSustainedMidis]);

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
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorIndex?: number, noteColorHex?: string, soundfontKey?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Map();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;

			const isSelf = playerId === SELF;
			const engine = engineRef.current;

			let effectiveFontKey: string;
			if (isSelf) {
				effectiveFontKey = currentSoundfontRef.current;
			} else {
				const requestedKey = soundfontKey ?? currentSoundfontRef.current;
				if (engine?.hasFont(requestedKey)) {
					effectiveFontKey = requestedKey;
				} else {
					if (requestedKey && !engine?.hasFont(requestedKey)) {
						loadSoundfontRef.current?.(requestedKey)?.catch(() => {});
					}
					effectiveFontKey = currentSoundfontRef.current;
				}
			}
			holders.set(playerId, effectiveFontKey);

			if (isSelf) {
				sustainedNotesRef.current.delete(midi);
				setLocalPressedMidis((prev) => (prev.includes(midi) ? prev : [...prev, midi].sort((a, b) => a - b)));
				setLocalSustainedMidis((prev) => (prev.includes(midi) ? prev.filter((n) => n !== midi) : prev));
			} else {
				peerSustainedNotesRef.current.get(playerId)?.delete(midi);
			}

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

			// spessasynth expects MIDI-spec velocity 0-127.
			const midiVel = vel > 1 ? Math.round(vel) : Math.max(1, Math.round(vel * 127));

			if (audioStartedRef.current && engine?.ready && engine.hasFont(effectiveFontKey)) {
				const channel = engine.channelForPlayer(playerId, isSelf);
				engine.selectFontOnChannel(channel, effectiveFontKey);
				engine.noteOn(channel, midi, midiVel);
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

	const stopNote = useCallback((midi: number, playerId: string = SELF, _soundfontKey?: string) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return;
		holders.delete(playerId);
		const isSelf = playerId === SELF;
		if (isSelf) {
			setLocalPressedMidis((prev) => prev.filter((n) => n !== midi));
		}

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		const engine = engineRef.current;

		let sustainActive: boolean;
		if (isSelf) {
			sustainActive =
				sustainModeRef.current === "off"
					? false
					: sustainModeRef.current === "always"
						? true
						: isSustainOnRef.current;
		} else {
			sustainActive = peerSustainRef.current.get(playerId) ?? false;
		}

		// The synth tracks CC64 internally per channel, so a noteOff while sustain
		// is on will leave the note ringing automatically — we just track the midi
		// for our own UI state.
		if (engine?.ready) {
			const channel = engine.channelForPlayer(playerId, isSelf);
			engine.noteOff(channel, midi);
		}

		if (sustainActive) {
			if (isSelf) {
				sustainedNotesRef.current.add(midi);
				setLocalSustainedMidis((prev) => (prev.includes(midi) ? prev : [...prev, midi].sort((a, b) => a - b)));
			} else {
				let peerSustainedSet = peerSustainedNotesRef.current.get(playerId);
				if (!peerSustainedSet) {
					peerSustainedSet = new Set();
					peerSustainedNotesRef.current.set(playerId, peerSustainedSet);
				}
				peerSustainedSet.add(midi);
			}
		}

		if (holders.size === 0) {
			noteHoldersRef.current.delete(midi);
			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.remove("active");
		}
	}, []);

	const releaseAllForPlayer = useCallback(
		(playerId: string) => {
			const midis: number[] = [];
			noteHoldersRef.current.forEach((holders, midi) => {
				if (holders.has(playerId)) midis.push(midi);
			});
			midis.forEach((midi) => stopNote(midi, playerId));

			if (playerId !== SELF) {
				const engine = engineRef.current;
				if (engine?.ready) engine.freePlayer(playerId);
				peerSustainRef.current.delete(playerId);
				peerSustainedNotesRef.current.delete(playerId);
			}
		},
		[stopNote],
	);

	const setPeerSustain = useCallback((peerId: string, active: boolean, _soundfontKey?: string) => {
		peerSustainRef.current.set(peerId, active);
		const engine = engineRef.current;
		if (engine?.ready) {
			const channel = engine.channelForPlayer(peerId, false);
			engine.setSustain(channel, active);
		}
		if (!active) {
			peerSustainedNotesRef.current.get(peerId)?.clear();
		}
	}, []);

	const setSustain = useCallback((active: boolean) => {
		isSustainOnRef.current = active;
		engineRef.current?.setSustain(SELF_CHANNEL, active);
		if (!active) {
			sustainedNotesRef.current.clear();
			setLocalSustainedMidis([]);
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

	const loadSoundfont = useCallback(async (key: string): Promise<void> => {
		const inst = instrumentsRef.current[key];
		if (!inst) throw new Error("Unknown soundfont");
		const engine = engineRef.current;
		if (!engine) throw new Error("Audio not initialized");
		if (engine.hasFont(key)) return;

		setLoadingSoundfont(key);
		try {
			await engine.loadFont(key, inst.url);
			setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
		} finally {
			setLoadingSoundfont((prev) => (prev === key ? null : prev));
		}
	}, []);

	useEffect(() => {
		loadSoundfontRef.current = loadSoundfont;
	}, [loadSoundfont]);

	const clearLocalHeldKeys = () => {
		// Close out any visualizer trails still flagged as held. Without this, a
		// soundfont switch releases the audio (via engine.releaseAllOnChannel)
		// but never runs the per-key stopNote that would set endTime — so the
		// canvas keeps extending those notes downward forever.
		const now = performance.now();
		for (const n of visNotesRef.current) {
			if (n.playerId === SELF && n.endTime === null) {
				n.endTime = now;
			}
		}
		noteHoldersRef.current.forEach((holders, midi) => {
			holders.delete(SELF);
			if (holders.size === 0) {
				noteHoldersRef.current.delete(midi);
				const keyEl = document.querySelector(`[data-midi="${midi}"]`);
				keyEl?.classList.remove("active");
			}
		});
		sustainedNotesRef.current.clear();
		setLocalPressedMidis([]);
		setLocalSustainedMidis([]);
	};

	const selectSoundfont = useCallback(
		async (key: string) => {
			if (!instrumentsRef.current[key]) return;
			const engine = engineRef.current;
			if (!engine) return;
			if (!engine.hasFont(key)) {
				try {
					await loadSoundfont(key);
				} catch {
					return;
				}
			}
			if (currentSoundfontRef.current === key) return;

			// Stop any notes the previous font was playing on our channel.
			engine.releaseAllOnChannel(SELF_CHANNEL);
			engine.selectFontOnChannel(SELF_CHANNEL, key);
			clearLocalHeldKeys();
			setCurrentSoundfont(key);
		},
		[loadSoundfont, setCurrentSoundfont],
	);

	// Restore the soundfont the user had selected before they left the site. Runs once when
	// the saved key becomes available (the dynamic catalog populates after the API responds).
	const soundfontRestoredRef = useRef(false);
	useEffect(() => {
		if (soundfontRestoredRef.current) return;
		const saved = loadPersistedSoundfont();
		if (!saved) {
			soundfontRestoredRef.current = true;
			return;
		}
		if (saved === currentSoundfontRef.current) {
			soundfontRestoredRef.current = true;
			return;
		}
		if (!instrumentsRef.current[saved]) return; // wait for dynamic catalog
		soundfontRestoredRef.current = true;
		void selectSoundfont(saved);
	}, [instruments, selectSoundfont]);

	const ensureSoundfontLoaded = useCallback(
		(key: string) => {
			if (!key) return;
			if (!instrumentsRef.current[key]) return;
			if (engineRef.current?.hasFont(key)) return;
			loadSoundfont(key).catch(() => {});
		},
		[loadSoundfont],
	);

	const connectMIDI = useCallback(
		(
			onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v),
			onStop: (note: number) => void = (n) => stopNote(n),
			onSustain: (active: boolean) => void = (active) => setSustain(active),
		) => {
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
									onSustain(pedalPressed);
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
		[playNote, stopNote, unlockAudio, setSustain],
	);

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const init = async () => {
			// Native AudioContext — Tone wraps it, but spessasynth needs the
			// genuine BaseAudioContext for its AudioWorkletNode constructor.
			const nativeCtx = await initAudioContext();

			const initialVolume = loadPersistedVolume();
			masterVolumeNodeRef.current = createMasterVolume(percentToDb(initialVolume));
			if (initialVolume === 0) masterVolumeNodeRef.current.mute = true;
			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);

			// Fetch the catalog in parallel with engine setup — the picker should
			// populate even if synth init fails for some reason.
			const catalogPromise = fetchDynamicSoundfonts().then((dynamic) => {
				if (Object.keys(dynamic).length > 0) {
					setInstruments((prev) => ({ ...prev, ...dynamic }));
				}
				return dynamic;
			});

			const engine = new SpessaSynthEngine();
			engineRef.current = engine;
			try {
				await engine.init(nativeCtx);
				if (engine.output && reverbRef.current) {
					Tone.connect(engine.output, reverbRef.current);
				}
			} catch (err) {
				console.error("spessasynth init failed:", err);
				connectMIDI();
				return;
			}

			const dynamic = await catalogPromise;
			const persisted = loadPersistedSoundfont();
			const startKey = persisted && dynamic[persisted] ? persisted : DEFAULT_SOUNDFONT;
			const startInst = dynamic[startKey] ?? BUILT_IN_INSTRUMENTS[startKey];
			if (startInst) {
				setLoadingSoundfont(startKey);
				try {
					await engine.loadFont(startKey, startInst.url);
					engine.selectFontOnChannel(SELF_CHANNEL, startKey);
					setLoadedSoundfonts([startKey]);
					setCurrentSoundfont(startKey);
				} catch (err) {
					console.error("Failed to load default soundfont:", err);
				} finally {
					setLoadingSoundfont(null);
				}
			}

			connectMIDI();
		};
		init();
	}, [connectMIDI, setCurrentSoundfont]);

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
		setPeerSustain,
		ensureSoundfontLoaded,
		setReverbWet,
		setMidiTranspose,
		setVelocityMode,
		setFixedVelocity,
		setSustainMode,
		localHeldMidis,
	};
};
