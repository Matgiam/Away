"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { recognizeChord, type RecognizedChord } from "@/lib/chordRecognition";

interface ChordDisplayProps {
	heldMidis: number[];
	enabled: boolean;
}

const HOLD_AFTER_RELEASE_MS = 700;

export const ChordDisplay = ({ heldMidis, enabled }: ChordDisplayProps) => {
	const currentChord = useMemo(() => recognizeChord(heldMidis), [heldMidis]);
	const [displayChord, setDisplayChord] = useState<RecognizedChord | null>(null);
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!enabled) {
			setDisplayChord(null);
			if (fadeTimeoutRef.current) {
				clearTimeout(fadeTimeoutRef.current);
				fadeTimeoutRef.current = null;
			}
			return;
		}

		if (currentChord) {
			if (fadeTimeoutRef.current) {
				clearTimeout(fadeTimeoutRef.current);
				fadeTimeoutRef.current = null;
			}
			setDisplayChord(currentChord);
		} else if (displayChord) {
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
			fadeTimeoutRef.current = setTimeout(() => {
				setDisplayChord(null);
				fadeTimeoutRef.current = null;
			}, HOLD_AFTER_RELEASE_MS);
		}
	}, [currentChord, enabled, displayChord]);

	useEffect(() => {
		return () => {
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
		};
	}, []);

	if (!enabled) return null;

	const visible = !!currentChord;
	const chord = displayChord ?? currentChord;
	if (!chord) return null;

	return (
		<div
			className={`pointer-events-none fixed left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ${
				visible ? "opacity-100" : "opacity-30"
			}`}
			style={{ bottom: "calc(150px + 24px)" }}
		>
			<div className="px-6 py-3 rounded-2xl border border-white/10 bg-[#0a0118]/85 backdrop-blur-xl shadow-2xl flex items-baseline gap-3">
				<span className="text-white text-3xl font-semibold tracking-wide whitespace-nowrap">
					{chord.label}
				</span>
				{chord.noteCount > 2 && (
					<span className="text-white/40 text-xs uppercase tracking-widest italic">
						{chord.noteCount} notes{chord.inversion ? " · inv." : ""}
					</span>
				)}
			</div>
		</div>
	);
};
