// ============================================================================
// courses/CourseFallingNotes.tsx
// ----------------------------------------------------------------------------
// Lane-based falling notes view specialised for course steps. Differs from
// the practice-mode visualizer in that the lanes are explicitly positioned
// by `progress` (0 = at the impact bar, 1 = top of the area) rather than
// driven by real time. Used for chord / sequence steps where the lane only
// needs to communicate "here are the targets".
// ============================================================================

"use client";

import { useEffect, useRef } from "react";

export type LaneItem = {
	midi: number;
	// Relative target position along the fall axis. 0 = at the impact bar, 1 = top of the area
	progress: number;
	// 0..1 — the column height
	height: number;
	color: string;
	// Outline glow for the currently-required note(s)
	glow?: boolean;
	// Faded out (already played / completed)
	faded?: boolean;
	// Skip the drop-in animation
	noDropIn?: boolean;
};

interface CourseFallingNotesProps {
	items: LaneItem[];
	// Timestamp when the current step entered. Used to animate the drop-in.
	stepStartedAt?: number;
	// Seconds to animate from top into target position
	dropDurationSeconds?: number;
}

const WHITE_KEY_COUNT = 52;
const FIRST_MIDI = 21;

function midiToLane(midi: number): { whiteKeyIndex: number; isBlack: boolean } {
	const safe = Math.max(21, Math.min(108, midi));
	const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	const name = noteNames[safe % 12];
	const isBlack = name.includes("#");
	let whiteIndex = 0;
	for (let m = FIRST_MIDI; m < safe; m++) {
		const n = noteNames[m % 12];
		if (!n.includes("#")) whiteIndex++;
	}
	if (isBlack) return { whiteKeyIndex: whiteIndex - 1, isBlack: true };
	return { whiteKeyIndex: whiteIndex, isBlack: false };
}

const LANE_CACHE = (() => {
	const map = new Map<number, { whiteKeyIndex: number; isBlack: boolean }>();
	for (let m = 21; m <= 108; m++) map.set(m, midiToLane(m));
	return map;
})();

export function CourseFallingNotes({
	items,
	stepStartedAt,
	dropDurationSeconds = 1.4,
}: CourseFallingNotesProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const itemsRef = useRef(items);
	const startRef = useRef(stepStartedAt ?? performance.now());
	const dropDurRef = useRef(dropDurationSeconds);

	useEffect(() => {
		itemsRef.current = items;
	}, [items]);
	useEffect(() => {
		startRef.current = stepStartedAt ?? performance.now();
	}, [stepStartedAt]);
	useEffect(() => {
		dropDurRef.current = dropDurationSeconds;
	}, [dropDurationSeconds]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let raf = 0;
		let cssWidth = 0;
		let cssHeight = 0;

		const resize = () => {
			const parent = canvas.parentElement;
			if (!parent) return;
			const dpr = window.devicePixelRatio || 1;
			cssWidth = parent.clientWidth;
			cssHeight = parent.clientHeight;
			canvas.width = cssWidth * dpr;
			canvas.height = cssHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const ro = new ResizeObserver(resize);
		ro.observe(canvas.parentElement!);
		window.addEventListener("resize", resize);
		resize();

		const WHITE_RATIO = 0.9;
		const BLACK_RATIO = 0.6;

		const draw = () => {
			raf = requestAnimationFrame(draw);
			ctx.clearRect(0, 0, cssWidth, cssHeight);

			const whiteKeyWidth = cssWidth / WHITE_KEY_COUNT;
			const blackKeyWidth = whiteKeyWidth * BLACK_RATIO;
			const whiteNoteWidth = whiteKeyWidth * WHITE_RATIO;
			const sideMargin = (whiteKeyWidth - whiteNoteWidth) / 2;

			ctx.fillStyle = "rgba(255,255,255,0.08)";
			ctx.fillRect(0, cssHeight - 2, cssWidth, 2);

			const list = itemsRef.current;
			const now = performance.now();
			const t = (now - startRef.current) / 1000;
			const dropDur = dropDurRef.current;
			// Easing: ease-out cubic gives a satisfying "thud" at the end
			const ease = (x: number) => 1 - Math.pow(1 - x, 3);
			const dropFromTop = dropDur > 0 ? Math.max(0, 1 - ease(Math.min(1, t / dropDur))) : 0;

			for (const item of list) {
				const lane = LANE_CACHE.get(item.midi);
				if (!lane) continue;

				let x: number;
				let w: number;
				if (lane.isBlack) {
					w = blackKeyWidth;
					x = (lane.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteNoteWidth;
					x = lane.whiteKeyIndex * whiteKeyWidth + sideMargin;
				}

				// Animated progress: blends from (item.progress + dropFromTop) down to item.progress
				const animatedProgress = item.noDropIn
					? item.progress
					: Math.min(1, item.progress + dropFromTop);
				const heightPx = Math.max(item.height * cssHeight, 22);
				const yBottom = cssHeight - animatedProgress * cssHeight;
				const yTop = yBottom - heightPx;

				const alpha = item.faded ? 0.18 : 1;
				ctx.fillStyle = withAlpha(item.color, alpha * 0.85);
				roundedRect(ctx, x, yTop, w, heightPx, 6);
				ctx.fill();

				if (item.glow && !item.faded && dropFromTop < 0.01) {
					// Pulse glow once the note has landed
					const pulse = 0.5 + 0.5 * Math.sin(t * 4);
					ctx.save();
					ctx.shadowColor = item.color;
					ctx.shadowBlur = 14 + pulse * 14;
					ctx.strokeStyle = `rgba(255,255,255,${0.6 + pulse * 0.35})`;
					ctx.lineWidth = 2.4;
					roundedRect(ctx, x, yTop, w, heightPx, 6);
					ctx.stroke();
					ctx.restore();
				}
			}
		};

		raf = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener("resize", resize);
		};
	}, []);

	return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	if (ctx.roundRect) {
		ctx.roundRect(x, y, w, h, radius);
	} else {
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + w - radius, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
		ctx.lineTo(x + w, y + h - radius);
		ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
		ctx.lineTo(x + radius, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
	}
}

function withAlpha(hex: string, alpha: number): string {
	const clean = hex.replace("#", "");
	if (clean.length !== 6) return hex;
	const r = parseInt(clean.slice(0, 2), 16);
	const g = parseInt(clean.slice(2, 4), 16);
	const b = parseInt(clean.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}
