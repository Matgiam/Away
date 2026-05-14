"use client";

import { useEffect, useRef } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface PlayerHudProps {
	title: string;
	currentTime: number;
	totalDuration: number;
	onSeek: (seconds: number) => void;
	playing: boolean;
	onPlayPause: () => void;
	loadState: "loading" | "ready" | "error";
	error: string | null;
}

const TIMELINE_WIDTH = 880;
const TIMELINE_HEIGHT = 30;
const HANDLE_SIZE = 30;
const PLAY_BUTTON_SIZE = 42;

export function PlayerHud({
	title,
	currentTime,
	totalDuration,
	onSeek,
	playing,
	onPlayPause,
	loadState,
	error,
}: PlayerHudProps) {
	const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

	return (
		<div className="pointer-events-none absolute top-7 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 select-none">
			<div className="pointer-events-auto flex flex-col items-center gap-3">
				<div className="text-white text-sm tabular-nums tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
					<span>{formatTime(currentTime)}</span>
					<span className="text-white/40 mx-2">/</span>
					<span className="text-white/60">{formatTime(totalDuration)}</span>
				</div>

				<div className="flex items-center gap-3">
					<PlayPauseButton
						playing={playing}
						onClick={onPlayPause}
						disabled={loadState !== "ready"}
					/>
					<Timeline progress={progress} totalDuration={totalDuration} onSeek={onSeek} />
				</div>

				<h1 className="text-white text-lg font-bold italic tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] text-center">
					{title}
				</h1>

				{loadState === "loading" && (
					<p className="text-white/50 italic text-xs">Loading MIDI…</p>
				)}
				{loadState === "error" && (
					<p className="text-red-300/80 italic text-xs">
						Could not load song{error ? ` — ${error}` : "."}
					</p>
				)}
			</div>
		</div>
	);
}

function PlayPauseButton({
	playing,
	onClick,
	disabled,
}: {
	playing: boolean;
	onClick: () => void;
	disabled: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`transition-transform ${
				disabled ? "opacity-40 cursor-not-allowed" : "hover:scale-110 cursor-pointer"
			}`}
			aria-label={playing ? "Pause" : "Play"}
			title={playing ? "Pause (Space)" : "Play (Space)"}
		>
			<DynamicLiquidGlass
				width={PLAY_BUTTON_SIZE}
				height={PLAY_BUTTON_SIZE}
				radius={PLAY_BUTTON_SIZE / 2}
				refractionLevel={0.8}
				specularOpacity={0.8}
				glassBgOpacity={0.08}
			>
				{playing ? (
					<svg width="12" height="12" viewBox="0 0 24 24" fill="white">
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</svg>
				) : (
					<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style={{ transform: "translateX(1px)" }}>
						<path d="M8 5v14l11-7L8 5Z" />
					</svg>
				)}
			</DynamicLiquidGlass>
		</button>
	);
}

function Timeline({
	progress,
	totalDuration,
	onSeek,
}: {
	progress: number;
	totalDuration: number;
	onSeek: (seconds: number) => void;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);

	const seekAtClientX = (clientX: number) => {
		const track = trackRef.current;
		if (!track || totalDuration <= 0) return;
		const rect = track.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		onSeek(pct * totalDuration);
	};

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!draggingRef.current) return;
			seekAtClientX(e.clientX);
		};
		const onUp = () => {
			draggingRef.current = false;
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		// totalDuration captured fresh through closure; refs handle live position
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [totalDuration]);

	const clampedProgress = Math.max(0, Math.min(1, progress));

	return (
		<div
			className="relative cursor-pointer"
			style={{ width: TIMELINE_WIDTH, height: HANDLE_SIZE }}
		>
			<div
				ref={trackRef}
				onMouseDown={(e) => {
					draggingRef.current = true;
					seekAtClientX(e.clientX);
				}}
				className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
				style={{ height: TIMELINE_HEIGHT }}
			>
				<DynamicLiquidGlass
					width={TIMELINE_WIDTH}
					height={TIMELINE_HEIGHT}
					radius={TIMELINE_HEIGHT / 2}
					refractionLevel={0.7}
					specularOpacity={0.55}
					glassBgOpacity={0.04}
				>
					<div className="relative w-full h-full">
						<div
							className="absolute left-0 top-0 bottom-0 bg-white/20 pointer-events-none"
							style={{
								width: `${clampedProgress * 100}%`,
								borderRadius: TIMELINE_HEIGHT / 2,
							}}
						/>
					</div>
				</DynamicLiquidGlass>
			</div>

			<div
				className="absolute top-1/2 pointer-events-none"
				style={{
					left: `${clampedProgress * 100}%`,
					transform: "translate(-50%, -50%)",
				}}
			>
				<DynamicLiquidGlass
					width={HANDLE_SIZE}
					height={HANDLE_SIZE}
					radius={HANDLE_SIZE / 2}
					refractionLevel={0.9}
					specularOpacity={0.95}
					glassBgOpacity={0.18}
				/>
			</div>
		</div>
	);
}

function formatTime(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}
