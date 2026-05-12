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

export const CONTROL_ACTIONS = [
	{ id: "octaveDown", label: "Octave down" },
	{ id: "octaveUp", label: "Octave up" },
	{ id: "sustain", label: "Sustain pedal" },
] as const;

export type ControlActionId = (typeof CONTROL_ACTIONS)[number]["id"];

export type ActionId = PianoActionId | ControlActionId;

export type Keybinds = Record<ActionId, string | null>;

export type LayoutPreset = "qwerty" | "azerty";

export const DEFAULT_BASE_MIDI = 60;
export const MIN_BASE_MIDI = 24;
export const MAX_BASE_MIDI = 84;

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

export const PRESETS: Record<LayoutPreset, Keybinds> = {
	qwerty: QWERTY_PRESET,
	azerty: AZERTY_PRESET,
};

const STORAGE_KEY = "away:keybinds";
const PRESET_STORAGE_KEY = "away:keybindPreset";
const ENABLED_STORAGE_KEY = "away:keyboardInputEnabled";

export function loadKeybinds(): Keybinds {
	if (typeof window === "undefined") return { ...QWERTY_PRESET };
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...QWERTY_PRESET };
		const parsed = JSON.parse(raw) as Partial<Keybinds>;
		return { ...QWERTY_PRESET, ...parsed } as Keybinds;
	} catch {
		return { ...QWERTY_PRESET };
	}
}

export function saveKeybinds(binds: Keybinds): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

export function loadActivePreset(): LayoutPreset | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
	if (raw === "qwerty" || raw === "azerty") return raw;
	return null;
}

export function saveActivePreset(preset: LayoutPreset | null): void {
	if (typeof window === "undefined") return;
	if (preset === null) {
		window.localStorage.removeItem(PRESET_STORAGE_KEY);
	} else {
		window.localStorage.setItem(PRESET_STORAGE_KEY, preset);
	}
}

export function loadKeyboardInputEnabled(): boolean {
	if (typeof window === "undefined") return true;
	const raw = window.localStorage.getItem(ENABLED_STORAGE_KEY);
	if (raw === null) return true;
	return raw === "true";
}

export function saveKeyboardInputEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
}

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

export function codeToDisplay(code: string | null | undefined): string {
	if (!code) return "—";
	if (FRIENDLY_CODE_NAMES[code]) return FRIENDLY_CODE_NAMES[code];
	if (code.startsWith("Key")) return code.slice(3);
	if (code.startsWith("Digit")) return code.slice(5);
	if (code.startsWith("Numpad")) return "Num " + code.slice(6);
	if (code.startsWith("F") && /^F\d+$/.test(code)) return code;
	return code;
}
