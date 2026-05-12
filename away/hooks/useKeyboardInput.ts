"use client";

import { useEffect, useRef } from "react";
import type { Keybinds, PianoActionId } from "@/lib/keybinds";
import { PIANO_ACTIONS, MIN_BASE_MIDI, MAX_BASE_MIDI } from "@/lib/keybinds";

const SEMITONE_BY_ACTION: Record<string, number> = PIANO_ACTIONS.reduce(
	(acc, a) => {
		acc[a.id] = a.semitone;
		return acc;
	},
	{} as Record<string, number>,
);

const CODE_IS_PIANO = new Set<string>(PIANO_ACTIONS.map((a) => a.id));

interface UseKeyboardInputOptions {
	enabled: boolean;
	keybinds: Keybinds;
	baseMidi: number;
	onPlay: (midi: number, velocity: number) => void;
	onStop: (midi: number) => void;
	onOctaveShift?: (delta: number) => void;
	onSustainChange?: (active: boolean) => void;
	onAnyKey?: () => void;
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
	const heldNotesRef = useRef<Map<string, number>>(new Map());
	const heldCodesRef = useRef<Set<string>>(new Set());
	const sustainHeldRef = useRef(false);

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
		const findAction = (code: string): string | null => {
			const binds = keybindsRef.current;
			for (const key in binds) {
				if (binds[key as keyof Keybinds] === code) return key;
			}
			return null;
		};

		const isEditableTarget = (target: EventTarget | null): boolean => {
			if (!(target instanceof HTMLElement)) return false;
			const tag = target.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
			if (target.isContentEditable) return true;
			return false;
		};

		const handleDown = (e: KeyboardEvent) => {
			if (!enabledRef.current) return;
			if (e.repeat) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isEditableTarget(e.target)) return;

			const action = findAction(e.code);
			if (!action) return;

			onAnyKeyRef.current?.();

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
			if (action === "sustain") {
				e.preventDefault();
				if (!sustainHeldRef.current) {
					sustainHeldRef.current = true;
					onSustainChangeRef.current?.(true);
				}
				return;
			}

			if (!CODE_IS_PIANO.has(action)) return;
			if (heldCodesRef.current.has(e.code)) return;

			const semitone = SEMITONE_BY_ACTION[action];
			const midi = baseMidiRef.current + semitone;
			if (midi < 21 || midi > 108) return;

			e.preventDefault();
			heldCodesRef.current.add(e.code);
			heldNotesRef.current.set(e.code, midi);
			onPlayRef.current(midi, 100);
		};

		const handleUp = (e: KeyboardEvent) => {
			const action = findAction(e.code);
			if (!action) return;

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
			const midi = heldNotesRef.current.get(e.code);
			heldNotesRef.current.delete(e.code);
			if (midi !== undefined) onStopRef.current(midi);
		};

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
	}, []);
}

export type { PianoActionId };
