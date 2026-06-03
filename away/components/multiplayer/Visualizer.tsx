// ============================================================================
// multiplayer/Visualizer.tsx
// ----------------------------------------------------------------------------
// Canvas-based falling-notes visualizer. Renders the `VisNote[]` array
// produced by useAudioEngine as coloured rectangles falling from the top of
// the screen down toward the piano.
//
// `fallSpeed` is pixels per second; `cornerRadius` rounds the rectangles.
// Notes that have a null endTime stretch downward in real time; once an
// endTime is stamped, the rectangle's height freezes and starts to fade.
// ============================================================================

"use client";

import { useRef, useEffect } from "react";
import { VisNote } from "@/lib/types";

interface VisualizerProps {
	noteLines: VisNote[];
	className?: string;
	fallSpeed?: number;
	cornerRadius?: number;
	enabled?: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({
	noteLines,
	className = "",
	fallSpeed = 40,
	cornerRadius = 6,
	enabled = true,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const noteLinesRef = useRef<VisNote[]>([]);
	const fallSpeedRef = useRef(fallSpeed);
	const cornerRadiusRef = useRef(cornerRadius);
	const enabledRef = useRef(enabled);

	useEffect(() => {
		noteLinesRef.current = noteLines;
	}, [noteLines]);
	useEffect(() => {
		fallSpeedRef.current = fallSpeed;
	}, [fallSpeed]);
	useEffect(() => {
		cornerRadiusRef.current = cornerRadius;
	}, [cornerRadius]);
	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;

		const resizeCanvas = () => {
			const parent = canvas.parentElement;
			if (!parent) return;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = parent.clientWidth * dpr;
			canvas.height = parent.clientHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		window.addEventListener("resize", resizeCanvas);
		const resizeObserver = new ResizeObserver(resizeCanvas);
		resizeObserver.observe(canvas.parentElement!);
		resizeCanvas();

		const WHITE_NOTE_RATIO = 0.9;
		const BLACK_NOTE_RATIO = 0.6;
		// Safety net for stuck trails. If a noteOff is dropped (peer disconnect,
		// race with soundfont switch, missed MIDI message), the VisNote stays
		// open and the trail extends forever. After MAX_HELD_MS we treat the
		// note as released and fade it out over FADE_MS so it cleanly leaves
		// the canvas instead of lingering.
		const MAX_HELD_MS = 10000;
		const FADE_MS = 1500;

		const draw = () => {
			const width = canvas.offsetWidth;
			const height = canvas.offsetHeight;
			const now = performance.now();

			ctx.clearRect(0, 0, width, height);

			if (!enabledRef.current) {
				animationFrameId = requestAnimationFrame(draw);
				return;
			}

			const speed = fallSpeedRef.current / 100;
			const radius = cornerRadiusRef.current;

			const whiteKeyWidth = width / 52;
			const whiteNoteWidth = whiteKeyWidth * WHITE_NOTE_RATIO;
			const whiteSideMargin = (whiteKeyWidth - whiteNoteWidth) / 2;
			const blackNoteWidth = whiteKeyWidth * BLACK_NOTE_RATIO;

			for (let i = 0; i < noteLinesRef.current.length; i++) {
				const note = noteLinesRef.current[i];

				let effectiveEndTime: number;
				let alpha = 1;
				if (note.endTime !== null) {
					effectiveEndTime = note.endTime;
				} else {
					const heldMs = now - note.startTime;
					if (heldMs <= MAX_HELD_MS) {
						effectiveEndTime = now;
					} else {
						effectiveEndTime = note.startTime + MAX_HELD_MS;
						alpha = Math.max(0, 1 - (heldMs - MAX_HELD_MS) / FADE_MS);
						if (alpha === 0) continue;
					}
				}

				const yEnd = height - (now - note.startTime) * speed;
				const yStart = height - (now - effectiveEndTime) * speed;
				const noteHeight = Math.max(yStart - yEnd, 8);

				if (yStart < -100) continue;

				let x: number, w: number;
				if (note.isBlack) {
					w = blackNoteWidth;
					x = (note.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteNoteWidth;
					x = note.whiteKeyIndex * whiteKeyWidth + whiteSideMargin;
				}

				ctx.globalAlpha = alpha;
				ctx.fillStyle = note.color;
				ctx.beginPath();
				if (ctx.roundRect) {
					ctx.roundRect(x, yEnd, w, noteHeight, [radius, radius, radius, radius]);
				} else {
					ctx.rect(x, yEnd, w, noteHeight);
				}
				ctx.fill();
			}
			ctx.globalAlpha = 1;

			animationFrameId = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			resizeObserver.disconnect();
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<div className={`relative z-10 w-full h-full ${className}`}>
			<canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
		</div>
	);
};
