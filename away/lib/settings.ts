export type VelocityMode = "dynamic" | "fixed";
export type SustainMode = "midi" | "always" | "off";
export type VisualizerStyle = "bars" | "lines";
// Maps to the AudioContext `latencyHint`:
//   "low"      → "interactive" (smallest buffer, lowest latency, most fragile)
//   "balanced" → "balanced"    (moderate buffer)
//   "stable"   → "playback"    (largest buffer, highest latency, crack-resistant)
// Changing this requires reloading the page — the AudioContext can't change
// hint after creation.
export type AudioLatency = "low" | "balanced" | "stable";

export interface AppSettings {
	reverbWet: number;
	velocityMode: VelocityMode;
	fixedVelocity: number;
	sustainMode: SustainMode;
	audioLatency: AudioLatency;
	globalTranspose: number;
	showNoteLabels: boolean;
	keyAnimations: boolean;
	visualizerEnabled: boolean;
	noteFallSpeed: number;
	noteCornerRadius: number;
	visualizerStyle: VisualizerStyle;
	backgroundAnimated: boolean;
	backgroundColor: string;
	reducedMotion: boolean;
	showPlayerColors: boolean;
	chatNotifications: boolean;
	chordRecognizerEnabled: boolean;
	metronomeEnabled: boolean;
	metronomeBpm: number;
	metronomeBeatsPerBar: number;
	metronomeVolume: number;
	metronomeVisible: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
	reverbWet: 0,
	velocityMode: "dynamic",
	fixedVelocity: 100,
	sustainMode: "midi",
	audioLatency: "balanced",
	globalTranspose: 0,
	showNoteLabels: false,
	keyAnimations: true,
	visualizerEnabled: true,
	noteFallSpeed: 40,
	noteCornerRadius: 6,
	visualizerStyle: "bars",
	backgroundAnimated: true,
	backgroundColor: "#0b0416",
	reducedMotion: false,
	showPlayerColors: true,
	chatNotifications: true,
	chordRecognizerEnabled: false,
	metronomeEnabled: false,
	metronomeBpm: 100,
	metronomeBeatsPerBar: 4,
	metronomeVolume: 60,
	metronomeVisible: false,
};

const STORAGE_KEY = "away:appSettings";

export function loadSettings(): AppSettings {
	if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<AppSettings>;
		return { ...DEFAULT_SETTINGS, ...parsed };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: AppSettings): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const AWAY_STORAGE_KEYS = [
	"away:masterVolume",
	"away:noteColorHex",
	"away:whiteNoteColorIndex",
	"away:blackNoteColorIndex",
	"away:noteColorIndex",
	"away:keybinds",
	"away:keybindPreset",
	"away:keyboardInputEnabled",
	"away:keybindBaseMidi",
	"away:appSettings",
	"away:selectedSoundfont",
];

export function resetAllSettings(): void {
	if (typeof window === "undefined") return;
	AWAY_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
}
