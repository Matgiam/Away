"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { generatePiano } from "@/lib/piano";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useMetronome } from "@/hooks/useMetronome";
import type { PianoKey, VisNote } from "@/lib/types";
import {
	DEFAULT_BASE_MIDI,
	loadActivePreset,
	loadKeybinds,
	loadKeyboardInputEnabled,
	saveActivePreset,
	saveKeybinds,
	saveKeyboardInputEnabled,
	type Keybinds,
	type LayoutPreset,
} from "@/lib/keybinds";
import {
	loadSettings,
	saveSettings,
	resetAllSettings,
	DEFAULT_SETTINGS,
	type AppSettings,
} from "@/lib/settings";

type AudioEngineContextValue = ReturnType<typeof useAudioEngine> & {
	pianoKeys: PianoKey[];
	noteLines: VisNote[];
	keyboardInputEnabled: boolean;
	setKeyboardInputEnabled: (enabled: boolean) => void;
	keybinds: Keybinds;
	setKeybinds: (binds: Keybinds) => void;
	keybindBaseMidi: number;
	setKeybindBaseMidi: (midi: number) => void;
	keybindPreset: LayoutPreset | null;
	setKeybindPreset: (preset: LayoutPreset | null) => void;
	settings: AppSettings;
	updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
	resetSettings: () => void;
	// When a feature (eg. improvisation backing) owns the metronome clock itself, it can call
	// suppressMetronome() to keep the global metronome silent so the two don't double-click out
	// of phase. Always pair with a matching resumeMetronome() on cleanup.
	suppressMetronome: () => void;
	resumeMetronome: () => void;
};

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

const BASE_MIDI_STORAGE_KEY = "away:keybindBaseMidi";

function loadBaseMidi(): number {
	if (typeof window === "undefined") return DEFAULT_BASE_MIDI;
	const raw = window.localStorage.getItem(BASE_MIDI_STORAGE_KEY);
	if (raw === null) return DEFAULT_BASE_MIDI;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return DEFAULT_BASE_MIDI;
	return parsed;
}

export function AudioEngineProvider({ children }: { children: ReactNode }) {
	const pianoKeys = useMemo(() => generatePiano(), []);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const engine = useAudioEngine(pianoKeys, setNoteLines);

	const [keyboardInputEnabled, setKeyboardInputEnabledState] = useState<boolean>(loadKeyboardInputEnabled);
	const [keybinds, setKeybindsState] = useState<Keybinds>(loadKeybinds);
	const [keybindBaseMidi, setKeybindBaseMidiState] = useState<number>(loadBaseMidi);
	const [keybindPreset, setKeybindPresetState] = useState<LayoutPreset | null>(loadActivePreset);
	const [settings, setSettingsState] = useState<AppSettings>(loadSettings);
	// Transient (not persisted) — a counter so multiple owners can suppress without trampling
	// each other. Metronome ticks only when this is 0.
	const [metronomeSuppressionCount, setMetronomeSuppressionCount] = useState(0);
	const suppressMetronome = useCallback(() => {
		setMetronomeSuppressionCount((c) => c + 1);
	}, []);
	const resumeMetronome = useCallback(() => {
		setMetronomeSuppressionCount((c) => Math.max(0, c - 1));
	}, []);

	const setKeyboardInputEnabled = useCallback((enabled: boolean) => {
		setKeyboardInputEnabledState(enabled);
		saveKeyboardInputEnabled(enabled);
	}, []);

	const setKeybinds = useCallback((binds: Keybinds) => {
		setKeybindsState(binds);
		saveKeybinds(binds);
	}, []);

	const setKeybindBaseMidi = useCallback((midi: number) => {
		setKeybindBaseMidiState(midi);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(BASE_MIDI_STORAGE_KEY, String(midi));
		}
	}, []);

	const setKeybindPreset = useCallback((preset: LayoutPreset | null) => {
		setKeybindPresetState(preset);
		saveActivePreset(preset);
	}, []);

	const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
		setSettingsState((prev) => {
			const next = { ...prev, [key]: value };
			saveSettings(next);
			return next;
		});
	}, []);

	const resetSettings = useCallback(() => {
		resetAllSettings();
		setSettingsState({ ...DEFAULT_SETTINGS });
		setKeyboardInputEnabledState(true);
		setKeybindsState(loadKeybinds());
		setKeybindBaseMidiState(DEFAULT_BASE_MIDI);
		setKeybindPresetState(null);
		engine.setMasterVolume(75);
		engine.setNoteColor("#db5361");
	}, [engine]);

	const { setReverbWet, setMidiTranspose, setVelocityMode, setFixedVelocity, setSustainMode } = engine;

	useEffect(() => {
		setReverbWet(settings.reverbWet);
	}, [settings.reverbWet, setReverbWet]);

	useEffect(() => {
		setMidiTranspose(settings.globalTranspose);
	}, [settings.globalTranspose, setMidiTranspose]);

	useEffect(() => {
		setVelocityMode(settings.velocityMode);
	}, [settings.velocityMode, setVelocityMode]);

	useEffect(() => {
		setFixedVelocity(settings.fixedVelocity);
	}, [settings.fixedVelocity, setFixedVelocity]);

	useEffect(() => {
		setSustainMode(settings.sustainMode);
	}, [settings.sustainMode, setSustainMode]);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const html = document.documentElement;
		if (settings.reducedMotion) html.classList.add("reduced-motion");
		else html.classList.remove("reduced-motion");
	}, [settings.reducedMotion]);

	// Global metronome — ticks whenever settings.metronomeEnabled is true on any page,
	// unless another component (eg. ImprovisationStage) has temporarily suppressed it.
	useMetronome({
		enabled: settings.metronomeEnabled && metronomeSuppressionCount === 0,
		bpm: settings.metronomeBpm,
		beatsPerBar: settings.metronomeBeatsPerBar,
		volume: settings.metronomeVolume,
	});

	const value = useMemo<AudioEngineContextValue>(
		() => ({
			...engine,
			pianoKeys,
			noteLines,
			keyboardInputEnabled,
			setKeyboardInputEnabled,
			keybinds,
			setKeybinds,
			keybindBaseMidi,
			setKeybindBaseMidi,
			keybindPreset,
			setKeybindPreset,
			settings,
			updateSetting,
			resetSettings,
			suppressMetronome,
			resumeMetronome,
		}),
		[
			engine,
			pianoKeys,
			noteLines,
			keyboardInputEnabled,
			setKeyboardInputEnabled,
			keybinds,
			setKeybinds,
			keybindBaseMidi,
			setKeybindBaseMidi,
			keybindPreset,
			setKeybindPreset,
			settings,
			updateSetting,
			resetSettings,
			suppressMetronome,
			resumeMetronome,
		],
	);

	return <AudioEngineContext.Provider value={value}>{children}</AudioEngineContext.Provider>;
}

export function useAudioEngineContext(): AudioEngineContextValue {
	const ctx = useContext(AudioEngineContext);
	if (!ctx) throw new Error("useAudioEngineContext must be used inside <AudioEngineProvider>");
	return ctx;
}
