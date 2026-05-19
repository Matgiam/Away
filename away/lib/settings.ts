export type VelocityMode = "dynamic" | "fixed";
export type SustainMode = "midi" | "always" | "off";
export type VisualizerStyle = "bars" | "lines";

export interface AppSettings {
	reverbWet: number;
	velocityMode: VelocityMode;
	fixedVelocity: number;
	sustainMode: SustainMode;
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
	showPlayerNames: boolean;
	chatSoundEnabled: boolean;
	chatNotifications: boolean;
	autoDownloadRecording: boolean;
	confirmLeaveRoom: boolean;
	chordRecognizerEnabled: boolean;
	metronomeEnabled: boolean;
	metronomeBpm: number;
	metronomeBeatsPerBar: number;
	metronomeVolume: number;
	metronomeVisible: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
	reverbWet: 20,
	velocityMode: "dynamic",
	fixedVelocity: 100,
	sustainMode: "midi",
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
	showPlayerNames: false,
	chatSoundEnabled: true,
	chatNotifications: true,
	autoDownloadRecording: true,
	confirmLeaveRoom: false,
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
