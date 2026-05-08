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
	const keyRefs = useRef<Record<number, HTMLDivElement | null>>({});
	const isMouseDown = useRef(false);
	const activeKeyRef = useRef<number | null>(null);

	const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]);
	const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);

	useEffect(() => {
		const handleMouseDown = () => {
			isMouseDown.current = true;
		};
		const handleMouseUp = () => {
			isMouseDown.current = false;
			if (activeKeyRef.current !== null) {
				onStopNote(activeKeyRef.current);
				activeKeyRef.current = null;
			}
		};
		window.addEventListener("mousedown", handleMouseDown);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousedown", handleMouseDown);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [onStopNote]);

	const startKey = useCallback(
		(midi: number) => {
			if (activeKeyRef.current === midi) return;
			if (activeKeyRef.current !== null) {
				onStopNote(activeKeyRef.current);
			}
			onPlayNote(midi, 127);
			activeKeyRef.current = midi;
		},
		[onPlayNote, onStopNote],
	);

	const handleMouseDownOnKey = useCallback(
		(midi: number) => {
			startKey(midi);
		},
		[startKey],
	);

	const handleMouseEnterOnKey = useCallback(
		(midi: number) => {
			if (isMouseDown.current && activeKeyRef.current !== midi) {
				startKey(midi);
			}
		},
		[startKey],
	);

	const blackKeyWidthPct = (100 / 52) * 0.6;

	return (
		<div
			className="myPiano w-full bg-[#111] relative select-none z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5"
			style={{ height: "150px", flexShrink: 0 }}
		>
			<div className="white-keys-container w-full h-full relative">
				{whiteKeys.map((key) => (
					<div
						key={key.midi}
						data-midi={key.midi}
						ref={(el) => {
							if (el) keyRefs.current[key.midi] = el;
						}}
						onMouseDown={() => handleMouseDownOnKey(key.midi)}
						onMouseEnter={() => handleMouseEnterOnKey(key.midi)}
						className="piano-key white"
					/>
				))}
			</div>

			<div className="black-keys-container absolute top-0 left-0 w-full h-full pointer-events-none">
				{blackKeys.map((key) => {
					const center = ((key.whiteKeyIndex + 1) * 100) / 52;
					const left = center - blackKeyWidthPct / 2;
					return (
						<div
							key={key.midi}
							data-midi={key.midi}
							ref={(el) => {
								if (el) keyRefs.current[key.midi] = el;
							}}
							onMouseDown={(e) => {
								e.stopPropagation();
								handleMouseDownOnKey(key.midi);
							}}
							onMouseEnter={() => handleMouseEnterOnKey(key.midi)}
							style={{ left: `${left}%` }}
							className="piano-key black pointer-events-auto"
						/>
					);
				})}
			</div>
		</div>
	);
};