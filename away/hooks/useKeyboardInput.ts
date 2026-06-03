// ============================================================================
// useKeyboardInput.ts
// ----------------------------------------------------------------------------
// Wires the computer keyboard up to the piano: maps `KeyboardEvent.code`
// values to piano actions (note triggers, sustain pedal, octave shift)
// according to the user's current `Keybinds`.
//
// Design notes:
//   * We use `code` (physical key position) instead of `key` (logical
//     character) so bindings survive layout changes mid-session.
//   * Held notes are tracked in two parallel structures — `heldCodesRef`
//     (which physical keys are down) and `heldNotesRef` (which MIDIs were
//     triggered, so we can release the *correct* note even if the user
//     octave-shifted while still holding the key).
//   * On blur (tab switch, alt-tab), every held note is released. Otherwise
//     the user comes back and the synth has a chord stuck on it.
//   * Callbacks and state inputs are mirrored into refs so the keydown /
//     keyup listeners can read the latest values without being torn down
//     and re-attached every render — a previous version of this had the
//     listeners in the deps array and dropped notes on every state change.
// ============================================================================

"use client";

import { useEffect, useRef } from "react";
import type { Keybinds, PianoActionId } from "@/lib/keybinds";
import { PIANO_ACTIONS, MIN_BASE_MIDI, MAX_BASE_MIDI } from "@/lib/keybinds";

// Pre-compute action id → semitone offset table for O(1) lookups in the
// hot path. Built once at module load.
const SEMITONE_BY_ACTION: Record<string, number> = PIANO_ACTIONS.reduce(
	(acc, a) => {
		acc[a.id] = a.semitone;
		return acc;
	},
	{} as Record<string, number>,
);

// Set of action ids that represent a piano note (excludes octave/sustain).
const CODE_IS_PIANO = new Set<string>(PIANO_ACTIONS.map((a) => a.id));

interface UseKeyboardInputOptions {
	enabled: boolean;          // master on/off — usually mirrors the settings panel
	keybinds: Keybinds;
	baseMidi: number;          // current "octave anchor"; shifts with octaveUp/Down
	onPlay: (midi: number, velocity: number) => void;
	onStop: (midi: number) => void;
	onOctaveShift?: (delta: number) => void;
	onSustainChange?: (active: boolean) => void;
	onAnyKey?: () => void;     // fires on any matched action — used by tutorials
}

export function useKeyboardInput({
	enabled,
	keybinds,
	baseMidi,
	onPlay,
	onStop,
	onOctaveShift,
	onSustainChange,
	onAnyKey,
}: UseKeyboardInputOptions) {
	// Per-keystate refs. heldCodesRef tracks the physical keys; heldNotesRef
	// tracks the MIDI value that was triggered (which can be different from
	// the current binding if the user octave-shifted while holding).
	const heldNotesRef = useRef<Map<string, number>>(new Map());
	const heldCodesRef = useRef<Set<string>>(new Set());
	const sustainHeldRef = useRef(false);

	// Mirror every input into a ref so the listeners (which install once and
	// stay forever) can read the latest values without re-binding.
	const enabledRef = useRef(enabled);
	const keybindsRef = useRef(keybinds);
	const baseMidiRef = useRef(baseMidi);
	const onPlayRef = useRef(onPlay);
	const onStopRef = useRef(onStop);
	const onOctaveShiftRef = useRef(onOctaveShift);
	const onSustainChangeRef = useRef(onSustainChange);
	const onAnyKeyRef = useRef(onAnyKey);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);
	useEffect(() => {
		keybindsRef.current = keybinds;
	}, [keybinds]);
	useEffect(() => {
		baseMidiRef.current = baseMidi;
	}, [baseMidi]);
	useEffect(() => {
		onPlayRef.current = onPlay;
	}, [onPlay]);
	useEffect(() => {
		onStopRef.current = onStop;
	}, [onStop]);
	useEffect(() => {
		onOctaveShiftRef.current = onOctaveShift;
	}, [onOctaveShift]);
	useEffect(() => {
		onSustainChangeRef.current = onSustainChange;
	}, [onSustainChange]);
	useEffect(() => {
		onAnyKeyRef.current = onAnyKey;
	}, [onAnyKey]);

	useEffect(() => {
		// Reverse-lookup helper: given a KeyboardEvent.code, which action (if any)
		// is bound to it right now?
		const findAction = (code: string): string | null => {
			const binds = keybindsRef.current;
			for (const key in binds) {
				if (binds[key as keyof Keybinds] === code) return key;
			}
			return null;
		};

		// Skip handling if the event target is a text input — we don't want to
		// trigger piano notes while the user is typing in chat or the username field.
		const isEditableTarget = (target: EventTarget | null): boolean => {
			if (!(target instanceof HTMLElement)) return false;
			const tag = target.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
			if (target.isContentEditable) return true;
			return false;
		};

		const handleDown = (e: KeyboardEvent) => {
			if (!enabledRef.current) return;
			if (e.repeat) return;                                   // ignore auto-repeat
			if (e.ctrlKey || e.metaKey || e.altKey) return;         // don't eat shortcuts
			if (isEditableTarget(e.target)) return;

			const action = findAction(e.code);
			if (!action) return;

			// "User pressed a bound key" — used by interactive tutorials.
			onAnyKeyRef.current?.();

			// Octave shift: clamp inside the playable range and only fire if there
			// was actually a change.
			if (action === "octaveDown") {
				e.preventDefault();
				const next = Math.max(MIN_BASE_MIDI, baseMidiRef.current - 12);
				if (next !== baseMidiRef.current) onOctaveShiftRef.current?.(next - baseMidiRef.current);
				return;
			}
			if (action === "octaveUp") {
				e.preventDefault();
				const next = Math.min(MAX_BASE_MIDI, baseMidiRef.current + 12);
				if (next !== baseMidiRef.current) onOctaveShiftRef.current?.(next - baseMidiRef.current);
				return;
			}
			// Sustain pedal — only fire the "on" callback on the first press.
			if (action === "sustain") {
				e.preventDefault();
				if (!sustainHeldRef.current) {
					sustainHeldRef.current = true;
					onSustainChangeRef.current?.(true);
				}
				return;
			}

			// Piano note. Block double-triggers (some keyboards send phantom downs).
			if (!CODE_IS_PIANO.has(action)) return;
			if (heldCodesRef.current.has(e.code)) return;

			// Compute the absolute MIDI from base + semitone offset, and clamp to
			// the 88-key piano range.
			const semitone = SEMITONE_BY_ACTION[action];
			const midi = baseMidiRef.current + semitone;
			if (midi < 21 || midi > 108) return;

			e.preventDefault();
			heldCodesRef.current.add(e.code);
			// Remember which MIDI we triggered for this physical key, so the
			// matching note-off releases the *right* note even after octave shift.
			heldNotesRef.current.set(e.code, midi);
			onPlayRef.current(midi, 100); // computer keyboard has no velocity — fixed 100
		};

		const handleUp = (e: KeyboardEvent) => {
			const action = findAction(e.code);
			if (!action) return;

			// Pedal release.
			if (action === "sustain") {
				if (sustainHeldRef.current) {
					sustainHeldRef.current = false;
					onSustainChangeRef.current?.(false);
				}
				return;
			}

			if (!CODE_IS_PIANO.has(action)) return;
			if (!heldCodesRef.current.has(e.code)) return;
			heldCodesRef.current.delete(e.code);
			// Use the MIDI we recorded at note-on, NOT the current binding —
			// see comment about octave shift above.
			const midi = heldNotesRef.current.get(e.code);
			heldNotesRef.current.delete(e.code);
			if (midi !== undefined) onStopRef.current(midi);
		};

		// Catch-all release used on blur and on unmount. Prevents stuck notes
		// when the user alt-tabs / closes the page mid-press.
		const releaseAll = () => {
			heldNotesRef.current.forEach((midi) => onStopRef.current(midi));
			heldNotesRef.current.clear();
			heldCodesRef.current.clear();
			if (sustainHeldRef.current) {
				sustainHeldRef.current = false;
				onSustainChangeRef.current?.(false);
			}
		};

		window.addEventListener("keydown", handleDown);
		window.addEventListener("keyup", handleUp);
		window.addEventListener("blur", releaseAll);

		return () => {
			window.removeEventListener("keydown", handleDown);
			window.removeEventListener("keyup", handleUp);
			window.removeEventListener("blur", releaseAll);
			releaseAll();
		};
	}, []); // bind once — deps are read through refs (see comments above)
}

export type { PianoActionId };
