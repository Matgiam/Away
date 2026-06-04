// ============================================================================
// useAudioEngine.ts
// ----------------------------------------------------------------------------
// The single owner of the live audio graph. Everywhere in the app that
// produces sound — local key presses, Web MIDI input, peers sending notes
// over WebRTC, MIDI playback in practice mode — funnels through `playNote`
// / `stopNote` exposed here.
//
// Graph (built once at boot):
//
//   [your keys / MIDI / peers] → SpessaSynthEngine (AudioWorklet)
//                                          │
//                                          ▼
//                                    Tone.Reverb → Tone.Volume → speakers
//
// Per-player channel routing happens inside SpessaSynthEngine — SELF on
// channel 0, peers on 1..15 (skipping 9, the drum slot). That's why a peer's
// soundfont choice doesn't affect anyone else's tone.
//
// Other responsibilities of this hook:
//   * Master volume (persisted in localStorage, with mute behaviour at 0).
//   * Note colour (persisted hex; legacy index-based settings migrated).
//   * Soundfont catalog fetching + per-font lazy loading.
//   * Reverb wet-mix slider.
//   * Web MIDI device discovery + the velocity-curve soft-compression.
//   * VisNote bookkeeping (the array driving the falling-bars visualizer).
//   * Sustain pedal state tracking (per-player so peer pedals are independent).
//   * Garbage-collection of stale VisNotes so a long jam doesn't accumulate
//     thousands of dead notes and cause GC pauses that crackle the worklet.
// ============================================================================

"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, Instrument, SoundfontCategory, instruments as BUILT_IN_INSTRUMENTS, DEFAULT_SOUNDFONT } from "../lib/types";
import { fetchDynamicSoundfonts } from "../lib/soundfonts";
import { SpessaSynthEngine, SELF_CHANNEL } from "../lib/spessaSynthEngine";
import { getVisualizerColor, getKeySolidColor, PLAYER_COLORS_SOLID } from "@/lib/playerColors";
import { darkenHex, normalizeHex } from "@/lib/color";

// Sentinel player id for the local user. Peer ids come from Supabase user ids.
const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

// Public soundfont option shape used by the picker.
export type SoundfontOption = { key: string; name: string; category: SoundfontCategory };

// Master volume slider is linear in user-perception (0..100) but Tone.Volume
// expects dB. 40·log10(p/100) gives roughly the standard "0 dB at 100, -40 dB
// at 10, -∞ at 0" curve that audio sliders typically use.
function percentToDb(percent: number): number {
	if (percent <= 0) return -Infinity;
	return 40 * Math.log10(percent / 100);
}

// localStorage keys. The three LEGACY_* entries are read once during migration
// (see loadPersistedNoteColor) but never written.
const VOLUME_STORAGE_KEY = "away:masterVolume";
const NOTE_COLOR_HEX_STORAGE_KEY = "away:noteColorHex";
const LEGACY_WHITE_INDEX_KEY = "away:whiteNoteColorIndex";
const LEGACY_BLACK_INDEX_KEY = "away:blackNoteColorIndex";
const LEGACY_SINGLE_INDEX_KEY = "away:noteColorIndex";
const SOUNDFONT_STORAGE_KEY = "away:selectedSoundfont";
const DEFAULT_NOTE_COLOR_HEX = PLAYER_COLORS_SOLID[0]; // brand red

// Returns the soundfont key the user last picked, or null on first visit.
function loadPersistedSoundfont(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(SOUNDFONT_STORAGE_KEY);
	} catch {
		return null;
	}
}

// Volume reader. Clamped to [0, 100] even if localStorage has garbage.
function loadPersistedVolume(): number {
	if (typeof window === "undefined") return DEFAULT_VOLUME_PERCENT;
	const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
	if (raw === null) return DEFAULT_VOLUME_PERCENT;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return DEFAULT_VOLUME_PERCENT;
	return Math.max(0, Math.min(100, parsed));
}

// Note colour reader with legacy migration. Older versions stored the colour
// as an index into PLAYER_COLORS_SOLID; we now store the hex directly. This
// function reads either form so users don't lose their picked colour.
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

// Top-level hook. `pianoKeys` is the static 88-key model from generatePiano();
// `setNoteLines` is the visualizer's state setter — the hook mutates a ref
// (visNotesRef) and pushes a shallow copy on every change so React re-renders.
export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	// Tone.start() has been called (user gesture unlocked audio).
	const audioStartedRef = useRef(false);
	// Synth + audio nodes — populated in the init effect.
	const engineRef = useRef<SpessaSynthEngine | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	// Per-MIDI-note tracking. The inner map is playerId → soundfontKey for
	// the player(s) currently holding that note. Multiple players can hold
	// the same note (chord-on-chord); the synth replays each on its own channel.
	const noteHoldersRef = useRef<Map<number, Map<string, string>>>(new Map());
	// Notes the local player has released but sustain pedal is keeping alive.
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	// Local sustain state. True = pedal down.
	const isSustainOnRef = useRef(false);
	// Backing store for the visualizer. setNoteLines is called with [...this]
	// whenever it changes so React can re-render the canvas.
	const visNotesRef = useRef<VisNote[]>([]);
	// One-shot guard so the audio init effect doesn't run twice in Strict Mode.
	const initializedRef = useRef(false);

	// Per-peer sustain mirrors the local sustain refs but keyed by peer id.
	const peerSustainRef = useRef<Map<string, boolean>>(new Map());
	const peerSustainedNotesRef = useRef<Map<string, Set<number>>>(new Map());
	// Mirror of `currentSoundfont` state into a ref — the playNote hot path
	// reads it without triggering re-renders.
	const currentSoundfontRef = useRef<string>(DEFAULT_SOUNDFONT);
	// Forward reference so playNote can ask the engine to lazy-load a peer's
	// font when we hear them play one we don't have.
	const loadSoundfontRef = useRef<((key: string) => Promise<void>) | null>(null);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);
	const [localPressedMidis, setLocalPressedMidis] = useState<number[]>([]);
	const [localSustainedMidis, setLocalSustainedMidis] = useState<number[]>([]);

	// Settings refs. The settings panel writes through the setter callbacks
	// below; the audio hot path reads the refs to avoid stale-closure bugs.
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

	// `Tone.start()` resumes the AudioContext after the required user gesture.
	// Idempotent — subsequent calls are no-ops. Every interaction that might
	// produce sound calls this first so we don't lose the first note of a
	// session to a suspended context.
	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	// MAIN ENTRY POINT for sound. Called by:
	//   * Local key / mouse / MIDI input (SELF playerId)
	//   * useWebRTC's onReceiveNote handler (peer playerId)
	//   * Practice mode's MIDI playback scheduler
	//   * Course player's demo-note scheduler
	//
	// Optional args control colour resolution and per-peer soundfont routing.
	const playNote = useCallback(
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorIndex?: number, noteColorHex?: string, soundfontKey?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Map();
				noteHoldersRef.current.set(midi, holders);
			}
			// Already holding this note for this player — drop the duplicate
			// (key auto-repeat, double-noteOn from MIDI, etc).
			if (holders.has(playerId)) return;

			const isSelf = playerId === SELF;
			const engine = engineRef.current;

			// Resolve the soundfont this note should play through. Self uses
			// the local selection; peers use the soundfont they reported in
			// presence (if we've loaded it; otherwise fall back to ours and
			// kick off a background load).
			let effectiveFontKey: string;
			if (isSelf) {
				effectiveFontKey = currentSoundfontRef.current;
			} else {
				const requestedKey = soundfontKey ?? currentSoundfontRef.current;
				if (engine?.hasFont(requestedKey)) {
					effectiveFontKey = requestedKey;
				} else {
					// Lazy-load missing peer font in the background — the next
					// note this peer plays will hit the right tone.
					if (requestedKey && !engine?.hasFont(requestedKey)) {
						loadSoundfontRef.current?.(requestedKey)?.catch(() => {});
					}
					effectiveFontKey = currentSoundfontRef.current;
				}
			}
			holders.set(playerId, effectiveFontKey);

			// Re-pressing a sustained note "refreshes" it — remove from the
			// sustained set so it'll behave like a normal hold.
			if (isSelf) {
				sustainedNotesRef.current.delete(midi);
				setLocalPressedMidis((prev) => (prev.includes(midi) ? prev : [...prev, midi].sort((a, b) => a - b)));
				setLocalSustainedMidis((prev) => (prev.includes(midi) ? prev.filter((n) => n !== midi) : prev));
			} else {
				peerSustainedNotesRef.current.get(playerId)?.delete(midi);
			}

			// Look up the static key info — used for layout (x, w) and the
			// black/white branching below.
			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			const isBlack = keyInfo?.isBlack ?? false;

			// Colour resolution priority:
			//   1. explicit hex (peer-supplied via presence)
			//   2. colour index (legacy / older callers)
			//   3. local note colour setting
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

			// Light up the physical key in the Piano component. Direct DOM
			// poke (no React re-render) — this is the hot path and we'd
			// otherwise re-render the whole keyboard on every key press.
			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			// spessasynth expects MIDI-spec velocity 0-127. Callers may pass
			// either a 0..1 normalised float or a raw MIDI int — handle both.
			const midiVel = vel > 1 ? Math.round(vel) : Math.max(1, Math.round(vel * 127));

			// Engine guards: don't try to play before audio is unlocked or
			// the soundfont is loaded — the worklet would just discard the event.
			if (audioStartedRef.current && engine?.ready && engine.hasFont(effectiveFontKey)) {
				const channel = engine.channelForPlayer(playerId, isSelf);
				engine.selectFontOnChannel(channel, effectiveFontKey);
				engine.noteOn(channel, midi, midiVel);
			}

			// Build a VisNote for the falling-bars visualizer.
			if (keyInfo) {
				// 52 white keys span the viewport width. Black keys are 60%
				// the width of a white key and centred between two whites.
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
				}

				const nowMs = performance.now();
				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: nowMs,
					endTime: null,
					isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: visColor,
					x,
					w,
					playerId,
				};

				// Drop notes that have scrolled offscreen so the array stays bounded.
				// Without this, a long jam session accumulates thousands of dead
				// VisNotes — every playNote then spreads the full array and the GC
				// churn on the main thread can stall the audio worklet, which is
				// one of the things that produces fast-play crackles. The cutoffs
				// match the Visualizer's stuck-trail fade (10s held + 1.5s fade)
				// so nothing visible is ever pruned.
				const STALE_RELEASED_MS = 5000;
				const STUCK_HELD_MS = 15000;
				visNotesRef.current = visNotesRef.current.filter((n) => {
					if (n.endTime === null) return nowMs - n.startTime < STUCK_HELD_MS;
					return nowMs - n.endTime < STALE_RELEASED_MS;
				});
				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines],
	);

	// Counterpart to playNote — clears the hold, applies sustain if active,
	// and closes the matching VisNote's endTime so the visualizer can fade it.
	const stopNote = useCallback((midi: number, playerId: string = SELF, _soundfontKey?: string) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return; // not actually holding
		holders.delete(playerId);
		const isSelf = playerId === SELF;
		if (isSelf) {
			setLocalPressedMidis((prev) => prev.filter((n) => n !== midi));
		}

		// Find the most recent VisNote still open for this midi+player and
		// stamp its endTime. findLast (not find) because a fast repeat could
		// leave two on the array for the same pitch.
		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		const engine = engineRef.current;

		// Decide whether sustain is in effect for this player on this note.
		// Settings override real pedal state for the local user; peers honour
		// whatever they last told us via setPeerSustain.
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

	// Used when a peer leaves the room — releases every note they were
	// holding so we don't keep peer audio ringing forever after a disconnect.
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

		// Drum kits live in Percussion and have "Kit" in the name; pitched
		// percussion (Kalimba, Xylophone, Celesta, …) shares the category but
		// must NOT be flagged as drums.
		const preferDrums = inst.category === "Percussion" && /\bkit\b/i.test(inst.name);

		setLoadingSoundfont(key);
		try {
			await engine.loadFont(key, inst.url, preferDrums);
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
		async (key: string): Promise<void> => {
			if (!key) return;
			if (!instrumentsRef.current[key]) return;
			if (engineRef.current?.hasFont(key)) return;
			await loadSoundfont(key).catch(() => {});
		},
		[loadSoundfont],
	);

	// Wire up the Web MIDI API. Iterates over every input device, attaches an
	// `onmidimessage` listener that decodes the status byte → command nibble
	// → note/velocity, and routes to onPlay / onStop / onSustain. Pattern
	// follows the MDN Web MIDI guide.
	const connectMIDI = useCallback(
		(
			onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v),
			onStop: (note: number) => void = (n) => stopNote(n),
			onSustain: (active: boolean) => void = (active) => setSustain(active),
		) => {
			const nav = navigator as any;
			// Brave hides the API behind a setting — surface a specific hint.
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
								// Some controllers send their first note before
								// the user has gestured anywhere in our UI — unlock here.
								unlockAudio();
								// MIDI status byte format: high nibble = command, low nibble = channel.
								const [cmd, note, vel] = msg.data;
								const command = cmd >> 4;

								const transposed = note + midiTransposeRef.current;
								if (transposed < 0 || transposed > 127) return;

								if (command === 11 && note === 64) {
									if (sustainModeRef.current !== "midi") return;
									const pedalPressed = vel >= 64;
									onSustain(pedalPressed);
								} else if (command === 9 && vel > 0) {
									let finalVel: number;
									if (velocityModeRef.current === "fixed") {
										finalVel = fixedVelocityRef.current;
									} else {
										// Soft-compress the upper velocity range. Noisy MIDI sensors
										// occasionally spike to 127 on fast passages, which triggers
										// the loudest sample layer and pops out of the mix. Below
										// 100 passes through unchanged; above 100 the slope flattens
										// so a rogue 127 lands around 118 — still firmly fortissimo
										// but no longer hitting the absolute-max layer.
										finalVel = vel <= 100 ? vel : Math.round(100 + (vel - 100) * 0.65);
									}
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

	// Boot effect — builds the audio graph, loads the default soundfont, and
	// hooks up Web MIDI. Runs exactly once even in StrictMode (initializedRef).
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
					const preferDrums = startInst.category === "Percussion" && /\bkit\b/i.test(startInst.name);
					await engine.loadFont(startKey, startInst.url, preferDrums);
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
