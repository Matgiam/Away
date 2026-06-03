// ============================================================================
// settings.ts
// ----------------------------------------------------------------------------
// The single source of truth for the app's user-configurable settings.
//
// Defines:
//   * `AppSettings`         — the shape of everything the settings panel can change.
//   * `DEFAULT_SETTINGS`    — values used for any new user / on factory-reset.
//   * `loadSettings` / `saveSettings` — localStorage persistence.
//   * `AWAY_STORAGE_KEYS`   — every localStorage key the app uses; lets
//                             `resetAllSettings` wipe the lot in one go.
//
// Persistence is intentionally localStorage-only — these settings don't sync
// across devices. Per-account preferences (username, friend list, etc.) live
// in Supabase, not here.
// ============================================================================

// "dynamic" → use the velocity sent by the controller/key event.
// "fixed"   → always use the user-chosen `fixedVelocity` instead.
export type VelocityMode = "dynamic" | "fixed";

// "midi"   → respect the sustain CC (64) from the controller / keyboard.
// "always" → sustain forced on (useful for slow practice).
// "off"    → ignore sustain entirely.
export type SustainMode = "midi" | "always" | "off";

// How the realtime visualizer draws — solid bars or thin lines.
export type VisualizerStyle = "bars" | "lines";

// Maps to the AudioContext `latencyHint`:
//   "low"      → "interactive" (smallest buffer, lowest latency, most fragile)
//   "balanced" → "balanced"    (moderate buffer)
//   "stable"   → "playback"    (largest buffer, highest latency, crack-resistant)
// Changing this requires reloading the page — the AudioContext can't change
// hint after creation.
export type AudioLatency = "low" | "balanced" | "stable";

// The full settings payload — every togglable preference, in one object.
export interface AppSettings {
	reverbWet: number;             // 0..1 — reverb mix amount
	velocityMode: VelocityMode;
	fixedVelocity: number;         // 1..127 — used when velocityMode === "fixed"
	sustainMode: SustainMode;
	audioLatency: AudioLatency;
	globalTranspose: number;       // semitones; shifts every note up/down
	showNoteLabels: boolean;       // letter labels under each key
	keyAnimations: boolean;        // press / release tween animations
	visualizerEnabled: boolean;
	noteFallSpeed: number;         // px/s in the falling-notes view
	noteCornerRadius: number;      // px — visual style for visualizer notes
	visualizerStyle: VisualizerStyle;
	backgroundAnimated: boolean;   // turn off the silk shader for low-power devices
	backgroundColor: string;       // base colour behind the shader
	reducedMotion: boolean;        // suppress decorative animations
	showPlayerColors: boolean;     // colour keys by player in multiplayer
	chatNotifications: boolean;
	chordRecognizerEnabled: boolean;
	metronomeEnabled: boolean;
	metronomeBpm: number;
	metronomeBeatsPerBar: number;
	metronomeVolume: number;       // 0..100
	metronomeVisible: boolean;     // show the small floating BPM widget
	showLatency: boolean;          // round-trip latency overlay (multiplayer)
}

// Defaults applied when nothing is persisted yet. Keep these conservative —
// new users land in a quiet, no-reverb, dynamic-velocity state.
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
	showLatency: false,
};

// Single localStorage key that holds the JSON-serialised AppSettings.
const STORAGE_KEY = "away:appSettings";

// Read the persisted settings, falling back to defaults on any failure.
// Always returns a *fresh* object (via spread) so mutations don't leak into
// the default constant.
export function loadSettings(): AppSettings {
	if (typeof window === "undefined") return { ...DEFAULT_SETTINGS }; // SSR
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS }; // first run
		const parsed = JSON.parse(raw) as Partial<AppSettings>;
		// Merge over defaults so newly-added fields get sensible values without
		// the user having to reset — i.e. backwards-compatible schema growth.
		return { ...DEFAULT_SETTINGS, ...parsed };
	} catch {
		return { ...DEFAULT_SETTINGS }; // malformed JSON / storage disabled
	}
}

// Persist the full settings object. Caller-managed — there's no debounce here.
export function saveSettings(settings: AppSettings): void {
	if (typeof window === "undefined") return; // SSR guard
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Every localStorage key the app touches. Used by `resetAllSettings` and
// by the "factory reset" button in the settings panel.
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

// Hard reset — clears every key listed above. The UI then reloads so the
// app boots cleanly against fresh defaults.
export function resetAllSettings(): void {
	if (typeof window === "undefined") return;
	AWAY_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
}
