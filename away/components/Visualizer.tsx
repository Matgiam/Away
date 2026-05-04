"use client";

import { useRef, useEffect } from "react";
import { VisNote } from "../lib/types";

interface VisualizerProps {
	noteLines: VisNote[];
	className?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ noteLines, className = "" }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const noteLinesRef = useRef<VisNote[]>([]);
	useEffect(() => {
		noteLinesRef.current = noteLines;
	}, [noteLines]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		const speed = 0.5;
		const resizeCanvas = () => {
			const parent = canvas.parentElement;
			if (parent) {
				canvas.width = parent.clientWidth * window.devicePixelRatio;
				canvas.height = parent.clientHeight * window.devicePixelRatio;
				ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
			}
		};
		window.addEventListener("resize", resizeCanvas);
		resizeCanvas();

		const draw = () => {
			const width = canvas.offsetWidth;
			const height = canvas.offsetHeight;
			const now = performance.now();

			ctx.clearRect(0, 0, width, height);

			const whiteKeyWidth = width / 52;

			for (let i = 0; i < noteLinesRef.current.length; i++) {
				const note = noteLinesRef.current[i];

				const yEnd = height - (now - note.startTime) * speed;
				const yStart = note.endTime ? height - (now - note.endTime) * speed : height;
				const noteHeight = Math.max(yStart - yEnd, 8);

				if (yStart < -100) continue;

				let x, w;
				if (note.isBlack) {
					w = whiteKeyWidth * 0.55;
					x = (note.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth * 0.75;
					x = note.whiteKeyIndex * whiteKeyWidth + whiteKeyWidth * 0.125;
				}

				const gradient = ctx.createLinearGradient(x, yEnd, x + w, yEnd);
				gradient.addColorStop(0, "rgba(252, 0, 25, 0.6)");

				ctx.fillStyle = gradient;

				ctx.beginPath();

				if (ctx.roundRect) {
					ctx.roundRect(x, yEnd, w, noteHeight, [6, 6, 6, 6]);
				} else {
					ctx.rect(x, yEnd, w, noteHeight);
				}
				ctx.fill();
			}

			animationFrameId = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<div className={`relative z-10 w-full h-full ${className}`}>
			<canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
		</div>
	);
};


