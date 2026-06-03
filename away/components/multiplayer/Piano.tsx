// ============================================================================
// multiplayer/Piano.tsx
// ----------------------------------------------------------------------------
// The 88-key piano UI used on every page that plays sound (home, multiplayer,
// practice, courses).
//
// Layout: 52 white keys lay out as flex children, each numbered black key is
// absolutely positioned above its neighbouring white key. Pointer events
// (mouse, touch) call onPlayNote / onStopNote — keyboard / MIDI input goes
// through other paths and reaches the same engine via useAudioEngine.
//
// `highlightedMidis` / `accentMidis` / `labelMidis` are used by the course
// system to colour-code specific keys ("press this one", "every C", etc).
// ============================================================================

"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { PianoKey } from "@/lib/types";

interface PianoProps {
	pianoKeys: PianoKey[];
	showKeys: boolean;
	onPlayNote: (midi: number, velocity: number) => void;
	onStopNote: (midi: number) => void;
	showNoteLabels?: boolean;
	keyAnimations?: boolean;
	highlightedMidis?: ReadonlySet<number> | number[];
	accentMidis?: ReadonlySet<number> | number[];
	labelMidis?: ReadonlyMap<number, string>;
}

const EMPTY_NUMBER_SET: ReadonlySet<number> = new Set<number>();

// Comfortable mezzo-piano for non-velocity-sensitive input (mouse, touch).
// Mouse clicks have no pressure, so the velocity is fully synthetic — 127
// clips, 90 was still too loud per user feedback. 65 sits in the mezzo-piano
// range that matches how a casual finger-tap feels on a real keyboard.
const MOUSE_DEFAULT_VELOCITY = 65;

function toSet(input: ReadonlySet<number> | number[] | undefined): ReadonlySet<number> {
	if (!input) return EMPTY_NUMBER_SET;
	if (input instanceof Set) return input;
	return new Set(input);
}

export const Piano: React.FC<PianoProps> = ({
	pianoKeys,
	showKeys,
	onPlayNote,
	onStopNote,
	showNoteLabels = false,
	keyAnimations = true,
	highlightedMidis,
	accentMidis,
	labelMidis,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const isMouseDown = useRef(false);
	const activeKeyRef = useRef<number | null>(null);

	const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]);
	const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);

	const startKey = useCallback(
		(midi: number) => {
			if (activeKeyRef.current === midi) return;
			if (activeKeyRef.current !== null) onStopNote(activeKeyRef.current);
			// Mouse input has no real velocity (no pressure sensitivity). 127
			// (max) hits hard and clips on most soundfonts; 90 feels like a
			// natural mezzo-forte on piano. The audio engine still respects the
			// user's velocity mode (fixed/dynamic) further downstream.
			onPlayNote(midi, MOUSE_DEFAULT_VELOCITY);
			activeKeyRef.current = midi;
		},
		[onPlayNote, onStopNote],
	);

	const stopActiveKey = useCallback(() => {
		if (activeKeyRef.current !== null) {
			onStopNote(activeKeyRef.current);
			activeKeyRef.current = null;
		}
	}, [onStopNote]);

	const hitTest = useCallback(
		(clientX: number, clientY: number) => {
			const els = document.elementsFromPoint(clientX, clientY);
			for (const el of els) {
				if (!(el instanceof HTMLElement)) continue;
				const midiAttr = el.getAttribute("data-midi");
				if (midiAttr) {
					const midi = parseInt(midiAttr, 10);
					if (!Number.isNaN(midi)) {
						startKey(midi);
						return;
					}
				}
			}
		},
		[startKey],
	);

	useEffect(() => {
		const handleMouseUp = () => {
			isMouseDown.current = false;
			stopActiveKey();
		};
		const handleMouseMove = (e: MouseEvent) => {
			if (!isMouseDown.current) return;
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
				stopActiveKey();
				return;
			}
			hitTest(e.clientX, e.clientY);
		};
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("mousemove", handleMouseMove);
		return () => {
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, [hitTest, stopActiveKey]);

	const handleKeyMouseDown = useCallback(
		(midi: number) => {
			isMouseDown.current = true;
			startKey(midi);
		},
		[startKey],
	);

	const blackKeyWidthPct = (100 / 52) * 0.6;

	const highlightSet = toSet(highlightedMidis);
	const accentSet = toSet(accentMidis);

	const labelFor = (midi: number, fallback: string): string | null => {
		if (labelMidis?.has(midi)) return labelMidis.get(midi) ?? null;
		if (showNoteLabels) return fallback;
		return null;
	};

	return (
		<div
			ref={containerRef}
			className={`myPiano w-full bg-[#111] relative select-none z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5 ${
				showNoteLabels ? "show-labels" : ""
			} ${keyAnimations ? "" : "no-key-anim"}`}
			style={{ height: "150px", flexShrink: 0 }}
		>
			<div className="white-keys-container">
				{whiteKeys.map((key) => {
					const isHL = highlightSet.has(key.midi);
					const isAccent = accentSet.has(key.midi);
					const lbl = labelFor(key.midi, key.noteName.replace(/-?\d+$/, ""));
					return (
						<div
							key={key.midi}
							data-midi={key.midi}
							onMouseDown={() => handleKeyMouseDown(key.midi)}
							className={`piano-key white ${isHL ? "course-highlight" : ""} ${isAccent ? "course-accent" : ""}`}
							style={{ pointerEvents: "auto" }}
						>
							{lbl && <span className="piano-label">{lbl}</span>}
						</div>
					);
				})}
			</div>

			<div className="black-keys-container absolute top-0 left-0 w-full h-full" style={{ pointerEvents: "none" }}>
				{blackKeys.map((key) => {
					const center = ((key.whiteKeyIndex + 1) * 100) / 52;
					const left = center - blackKeyWidthPct / 2;
					const isHL = highlightSet.has(key.midi);
					const isAccent = accentSet.has(key.midi);
					return (
						<div
							key={key.midi}
							data-midi={key.midi}
							onMouseDown={() => handleKeyMouseDown(key.midi)}
							style={{ left: `${left}%`, pointerEvents: "auto" }}
							className={`piano-key black ${isHL ? "course-highlight" : ""} ${isAccent ? "course-accent" : ""}`}
						/>
					);
				})}
			</div>
		</div>
	);
};
