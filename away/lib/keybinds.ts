// ============================================================================
// keybinds.ts
// ----------------------------------------------------------------------------
// Maps computer-keyboard keys to piano actions (note triggers, sustain pedal,
// octave shift). The mapping is layout-aware (QWERTY vs AZERTY) and fully
// user-customisable through the KeybindConfig panel.
//
// Concepts:
//   * `PIANO_ACTIONS`    — 24 entries (two octaves) ordered by semitone.
//                          Each action is "play note N semitones from the base
//                          MIDI", so the same binding works at any octave.
//   * `CONTROL_ACTIONS`  — octave up/down + sustain pedal.
//   * `Keybinds`         — a record mapping every action id → a KeyboardEvent
//                          `code` (e.g. "KeyA", "Space") or `null` if unbound.
//   * `LayoutPreset`     — built-in QWERTY / AZERTY presets the user can pick.
//
// Persistence is via localStorage. The `STORAGE_KEY` constants below are the
// raw keys, the helpers are the only thing the rest of the app should call.
// ============================================================================

// Two octaves of "play this semitone above the base note" actions. The base
// note is configurable (`DEFAULT_BASE_MIDI` = middle C = 60), so the same
// bindings work for high or low octaves just by moving the base.
export const PIANO_ACTIONS = [
	{ id: "C0", label: "C (low)", semitone: 0 },
	{ id: "Cs0", label: "C♯ / D♭ (low)", semitone: 1 },
	{ id: "D0", label: "D (low)", semitone: 2 },
	{ id: "Ds0", label: "D♯ / E♭ (low)", semitone: 3 },
	{ id: "E0", label: "E (low)", semitone: 4 },
	{ id: "F0", label: "F (low)", semitone: 5 },
	{ id: "Fs0", label: "F♯ / G♭ (low)", semitone: 6 },
	{ id: "G0", label: "G (low)", semitone: 7 },
	{ id: "Gs0", label: "G♯ / A♭ (low)", semitone: 8 },
	{ id: "A0", label: "A (low)", semitone: 9 },
	{ id: "As0", label: "A♯ / B♭ (low)", semitone: 10 },
	{ id: "B0", label: "B (low)", semitone: 11 },
	{ id: "C1", label: "C (high)", semitone: 12 },
	{ id: "Cs1", label: "C♯ / D♭ (high)", semitone: 13 },
	{ id: "D1", label: "D (high)", semitone: 14 },
	{ id: "Ds1", label: "D♯ / E♭ (high)", semitone: 15 },
	{ id: "E1", label: "E (high)", semitone: 16 },
	{ id: "F1", label: "F (high)", semitone: 17 },
	{ id: "Fs1", label: "F♯ / G♭ (high)", semitone: 18 },
	{ id: "G1", label: "G (high)", semitone: 19 },
	{ id: "Gs1", label: "G♯ / A♭ (high)", semitone: 20 },
	{ id: "A1", label: "A (high)", semitone: 21 },
	{ id: "As1", label: "A♯ / B♭ (high)", semitone: 22 },
	{ id: "B1", label: "B (high)", semitone: 23 },
] as const;

export type PianoActionId = (typeof PIANO_ACTIONS)[number]["id"];

// Non-note actions — pedal + octave shift. Kept separate so the UI can
// render them under a different heading.
export const CONTROL_ACTIONS = [
	{ id: "octaveDown", label: "Octave down" },
	{ id: "octaveUp", label: "Octave up" },
	{ id: "sustain", label: "Sustain pedal" },
] as const;

export type ControlActionId = (typeof CONTROL_ACTIONS)[number]["id"];

// Union of every action id — used as the key type for the Keybinds map.
export type ActionId = PianoActionId | ControlActionId;

// One binding entry: action id → KeyboardEvent.code, or null if unbound.
// Using `code` (not `key`) means bindings stick to the *physical* key, so
// they survive layout changes mid-session.
export type Keybinds = Record<ActionId, string | null>;

export type LayoutPreset = "qwerty" | "azerty";

// Default base note — middle C. Shifted by the octave up/down controls.
export const DEFAULT_BASE_MIDI = 60;
// Bounds keep the keyboard input on a usable part of the piano even after
// repeated octave shifts.
export const MIN_BASE_MIDI = 24;
export const MAX_BASE_MIDI = 84;

// AZERTY (mostly continental Europe) preset. Keys arranged so the home row
// covers the lower octave and the top row covers the upper octave.
export const AZERTY_PRESET: Keybinds = {
	C0: "KeyZ",
	Cs0: "KeyS",
	D0: "KeyX",
	Ds0: "KeyD",
	E0: "KeyC",
	F0: "KeyV",
	Fs0: "KeyG",
	G0: "KeyB",
	Gs0: "KeyH",
	A0: "KeyN",
	As0: "KeyJ",
	B0: "KeyM",
	C1: "KeyQ",
	Cs1: "Digit2",
	D1: "KeyW",
	Ds1: "Digit3",
	E1: "KeyE",
	F1: "KeyR",
	Fs1: "Digit5",
	G1: "KeyT",
	Gs1: "Digit6",
	A1: "KeyY",
	As1: "Digit7",
	B1: "KeyU",
	octaveDown: "Minus",
	octaveUp: "Equal",
	sustain: "Space",
};

// QWERTY preset — same idea as AZERTY but adjusted for the standard US layout.
// Note B0 lands on Comma (",") because KeyM is already taken by something
// else in the QWERTY arrangement.
export const QWERTY_PRESET: Keybinds = {
	C0: "KeyW",
	Cs0: "KeyS",
	D0: "KeyX",
	Ds0: "KeyD",
	E0: "KeyC",
	F0: "KeyV",
	Fs0: "KeyG",
	G0: "KeyB",
	Gs0: "KeyH",
	A0: "KeyN",
	As0: "KeyJ",
	B0: "Comma",
	C1: "KeyA",
	Cs1: "Digit2",
	D1: "KeyZ",
	Ds1: "Digit3",
	E1: "KeyE",
	F1: "KeyR",
	Fs1: "Digit5",
	G1: "KeyT",
	Gs1: "Digit6",
	A1: "KeyY",
	As1: "Digit7",
	B1: "KeyU",
	octaveDown: "Minus",
	octaveUp: "Equal",
	sustain: "Space",
};

// Lookup so the picker can resolve "qwerty" → bindings without a switch.
export const PRESETS: Record<LayoutPreset, Keybinds> = {
	qwerty: QWERTY_PRESET,
	azerty: AZERTY_PRESET,
};

// localStorage keys — kept private to this module; callers go through the
// `load*` / `save*` helpers.
const STORAGE_KEY = "away:keybinds";
const PRESET_STORAGE_KEY = "away:keybindPreset";
const ENABLED_STORAGE_KEY = "away:keyboardInputEnabled";

// Read persisted bindings; merge over QWERTY so newly-added actions get
// sensible defaults without forcing a reset.
export function loadKeybinds(): Keybinds {
	if (typeof window === "undefined") return { ...QWERTY_PRESET }; // SSR
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...QWERTY_PRESET };
		const parsed = JSON.parse(raw) as Partial<Keybinds>;
		return { ...QWERTY_PRESET, ...parsed } as Keybinds;
	} catch {
		return { ...QWERTY_PRESET };
	}
}

// Persist the full binding map.
export function saveKeybinds(binds: Keybinds): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

// Returns "qwerty" / "azerty" if the user explicitly picked a preset,
// or null if they're using a custom mapping.
export function loadActivePreset(): LayoutPreset | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
	if (raw === "qwerty" || raw === "azerty") return raw;
	return null;
}

// Persist the active preset (or clear it if `preset` is null, meaning the
// user has gone custom).
export function saveActivePreset(preset: LayoutPreset | null): void {
	if (typeof window === "undefined") return;
	if (preset === null) {
		window.localStorage.removeItem(PRESET_STORAGE_KEY);
	} else {
		window.localStorage.setItem(PRESET_STORAGE_KEY, preset);
	}
}

// Master on/off for computer-keyboard input. Defaults to ON for first-time
// users — they almost always want to be able to play with the keyboard.
export function loadKeyboardInputEnabled(): boolean {
	if (typeof window === "undefined") return true;
	const raw = window.localStorage.getItem(ENABLED_STORAGE_KEY);
	if (raw === null) return true; // unset = enabled
	return raw === "true";
}

export function saveKeyboardInputEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
}

// User-facing labels for KeyboardEvent.code values. The default "KeyA" /
// "Digit2" / "Numpad7" are ugly to display, so we map the common ones.
const FRIENDLY_CODE_NAMES: Record<string, string> = {
	Space: "Space",
	Enter: "Enter",
	Tab: "Tab",
	Escape: "Esc",
	Backspace: "Backspace",
	ShiftLeft: "L Shift",
	ShiftRight: "R Shift",
	ControlLeft: "L Ctrl",
	ControlRight: "R Ctrl",
	AltLeft: "L Alt",
	AltRight: "R Alt",
	MetaLeft: "L Cmd",
	MetaRight: "R Cmd",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Minus: "−",
	Equal: "=",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Semicolon: ";",
	Quote: "'",
	Comma: ",",
	Period: ".",
	Slash: "/",
	Backquote: "`",
	CapsLock: "Caps",
	NumpadAdd: "Num +",
	NumpadSubtract: "Num −",
	NumpadMultiply: "Num ×",
	NumpadDivide: "Num ÷",
	NumpadEnter: "Num Enter",
	NumpadDecimal: "Num .",
};

// Pretty-print a KeyboardEvent.code for the settings panel. Falls back to
// stripping common prefixes ("Key", "Digit", "Numpad") so "KeyA" → "A",
// "Digit3" → "3", "NumpadAdd" → "Num +" (already in the map above).
export function codeToDisplay(code: string | null | undefined): string {
	if (!code) return "—"; // unbound
	if (FRIENDLY_CODE_NAMES[code]) return FRIENDLY_CODE_NAMES[code];
	if (code.startsWith("Key")) return code.slice(3);     // "KeyA" → "A"
	if (code.startsWith("Digit")) return code.slice(5);   // "Digit3" → "3"
	if (code.startsWith("Numpad")) return "Num " + code.slice(6);
	if (code.startsWith("F") && /^F\d+$/.test(code)) return code; // F-keys: "F5" → "F5"
	return code; // unknown — show the raw code rather than nothing
}
