// ============================================================================
// practice/FallingNotes.tsx
// ----------------------------------------------------------------------------
// Time-driven falling notes used by practice mode (and the demo stage in
// courses). Reads `notes[]` + `currentTime` + `lookAheadSeconds` and draws
// every note whose window overlaps the visible band.
//
// Per-note colour is decided by `handForNote` so right-hand and left-hand
// columns can be tinted differently. `gateMidis` shows which notes the user
// must play next; `hitMidis` shows what they've already hit.
// ============================================================================

"use client";

import { useEffect, useRef } from "react";
import type { ParsedNote } from "@/lib/practice/midiParser";

export type Hand = "right" | "left";

interface FallingNotesProps {
	notes: ParsedNote[];
	currentTime: number;
	lookAheadSeconds: number;
	handForNote: (note: ParsedNote) => Hand;
	colors: Record<Hand, string>;
	gateMidis: ReadonlySet<number>;
	hitMidis: ReadonlySet<number>;
	gateStartTime: number | null;
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
	if (isBlack) {
		return { whiteKeyIndex: whiteIndex - 1, isBlack: true };
	}
	return { whiteKeyIndex: whiteIndex, isBlack: false };
}

const LANE_CACHE = (() => {
	const map = new Map<number, { whiteKeyIndex: number; isBlack: boolean }>();
	for (let m = 21; m <= 108; m++) map.set(m, midiToLane(m));
	return map;
})();

export function FallingNotes({
	notes,
	currentTime,
	lookAheadSeconds,
	handForNote,
	colors,
	gateMidis,
	hitMidis,
	gateStartTime,
}: FallingNotesProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const notesRef = useRef(notes);
	const tRef = useRef(currentTime);
	const lookRef = useRef(lookAheadSeconds);
	const handForNoteRef = useRef(handForNote);
	const colorsRef = useRef(colors);
	const gateMidisRef = useRef(gateMidis);
	const hitMidisRef = useRef(hitMidis);
	const gateStartTimeRef = useRef(gateStartTime);

	useEffect(() => {
		notesRef.current = notes;
	}, [notes]);
	useEffect(() => {
		tRef.current = currentTime;
	}, [currentTime]);
	useEffect(() => {
		lookRef.current = lookAheadSeconds;
	}, [lookAheadSeconds]);
	useEffect(() => {
		handForNoteRef.current = handForNote;
	}, [handForNote]);
	useEffect(() => {
		colorsRef.current = colors;
	}, [colors]);
	useEffect(() => {
		gateMidisRef.current = gateMidis;
	}, [gateMidis]);
	useEffect(() => {
		hitMidisRef.current = hitMidis;
	}, [hitMidis]);
	useEffect(() => {
		gateStartTimeRef.current = gateStartTime;
	}, [gateStartTime]);

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

			const t = tRef.current;
			const look = lookRef.current;
			const palette = colorsRef.current;
			const getHand = handForNoteRef.current;
			const gates = gateMidisRef.current;
			const hits = hitMidisRef.current;
			const gateStart = gateStartTimeRef.current;

			const whiteKeyWidth = cssWidth / WHITE_KEY_COUNT;
			const blackKeyWidth = whiteKeyWidth * BLACK_RATIO;
			const whiteNoteWidth = whiteKeyWidth * WHITE_RATIO;
			const sideMargin = (whiteKeyWidth - whiteNoteWidth) / 2;

			ctx.fillStyle = "rgba(255,255,255,0.06)";
			ctx.fillRect(0, cssHeight - 2, cssWidth, 2);

			const items = notesRef.current;
			for (let i = 0; i < items.length; i++) {
				const note = items[i];
				const endTime = note.startSeconds + note.durationSeconds;
				if (endTime < t || note.startSeconds > t + look) continue;

				const startProgress = (note.startSeconds - t) / look;
				const endProgress = (endTime - t) / look;

				const yTop = cssHeight - endProgress * cssHeight;
				const yBottom = cssHeight - startProgress * cssHeight;
				const height = Math.max(yBottom - yTop, 6);

				const lane = LANE_CACHE.get(note.midi);
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

				const hand = getHand(note);
				const baseColor = palette[hand];
				const noteColor = lane.isBlack ? darken(baseColor, 0.6) : baseColor;

				const isAtGate =
					gateStart !== null &&
					gates.has(note.midi) &&
					Math.abs(note.startSeconds - gateStart) < 0.005;
				const isHit = isAtGate && hits.has(note.midi);

				let alpha = Math.min(1, Math.max(0.5, 0.55 + (note.velocity / 127) * 0.4));
				if (isHit) alpha = 0.18;

				ctx.fillStyle = withAlpha(noteColor, alpha);
				roundedRect(ctx, x, yTop, w, height, 6);
				ctx.fill();

				if (isAtGate && !isHit) {
					ctx.save();
					ctx.shadowColor = noteColor;
					ctx.shadowBlur = 18;
					ctx.strokeStyle = "rgba(255,255,255,0.85)";
					ctx.lineWidth = 2;
					roundedRect(ctx, x, yTop, w, height, 6);
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

	return (
		<canvas
			ref={canvasRef}
			style={{ width: "100%", height: "100%", display: "block" }}
		/>
	);
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

function darken(hex: string, factor: number): string {
	const clean = hex.replace("#", "");
	if (clean.length !== 6) return hex;
	const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * factor));
	const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * factor));
	const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * factor));
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function withAlpha(hex: string, alpha: number): string {
	const clean = hex.replace("#", "");
	if (clean.length !== 6) return hex;
	const r = parseInt(clean.slice(0, 2), 16);
	const g = parseInt(clean.slice(2, 4), 16);
	const b = parseInt(clean.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}
