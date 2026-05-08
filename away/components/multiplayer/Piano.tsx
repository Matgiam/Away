"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { PianoKey } from "@/lib/types";

interface PianoProps {
	pianoKeys: PianoKey[];
	showKeys: boolean;
	onPlayNote: (midi: number, velocity: number) => void;
	onStopNote: (midi: number) => void;
}

export const Piano: React.FC<PianoProps> = ({ pianoKeys, showKeys, onPlayNote, onStopNote }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const isMouseDown = useRef(false);
	const activeKeyRef = useRef<number | null>(null);

	const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]);
	const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);

	const startKey = useCallback(
		(midi: number) => {
			if (activeKeyRef.current === midi) return;
			if (activeKeyRef.current !== null) onStopNote(activeKeyRef.current);
			onPlayNote(midi, 127);
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

	return (
		<div
			ref={containerRef}
			className="myPiano w-full bg-[#111] relative select-none z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5"
			style={{ height: "150px", flexShrink: 0 }}
		>
			<div className="white-keys-container">
				{whiteKeys.map((key) => (
					<div
						key={key.midi}
						data-midi={key.midi}
						onMouseDown={() => handleKeyMouseDown(key.midi)}
						className="piano-key white"
						style={{ pointerEvents: "auto" }}
					/>
				))}
			</div>

			<div className="black-keys-container absolute top-0 left-0 w-full h-full" style={{ pointerEvents: "none" }}>
				{blackKeys.map((key) => {
					const center = ((key.whiteKeyIndex + 1) * 100) / 52;
					const left = center - blackKeyWidthPct / 2;
					return (
						<div
							key={key.midi}
							data-midi={key.midi}
							onMouseDown={() => handleKeyMouseDown(key.midi)}
							style={{ left: `${left}%`, pointerEvents: "auto" }}
							className="piano-key black"
						/>
					);
				})}
			</div>
		</div>
	);
};
