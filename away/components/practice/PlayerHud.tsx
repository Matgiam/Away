"use client";

interface PlayerHudProps {
	title: string;
	currentTime: number;
	totalDuration: number;
	onSeek: (seconds: number) => void;
	loadState: "loading" | "ready" | "error";
	error: string | null;
}

export function PlayerHud({
	title,
	currentTime,
	totalDuration,
	onSeek,
	loadState,
	error,
}: PlayerHudProps) {
	const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

	return (
		<div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 select-none">
			<div className="pointer-events-auto flex flex-col items-center w-[640px] max-w-[60vw]">
				<div className="text-white text-sm tabular-nums tracking-wide mb-2">
					<span>{formatTime(currentTime)}</span>
					<span className="text-white/40 mx-2">/</span>
					<span className="text-white/60">{formatTime(totalDuration)}</span>
				</div>

				<Timeline progress={progress} totalDuration={totalDuration} onSeek={onSeek} />

				<h1 className="mt-3 text-white text-base font-bold italic tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] text-center">
					{title}
				</h1>

				{loadState === "loading" && (
					<p className="mt-1 text-white/50 italic text-xs">Loading MIDI…</p>
				)}
				{loadState === "error" && (
					<p className="mt-1 text-red-300/80 italic text-xs">
						Could not load song{error ? ` — ${error}` : "."}
					</p>
				)}
			</div>
		</div>
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
	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (totalDuration <= 0) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		onSeek(pct * totalDuration);
	};

	return (
		<div
			onClick={handleClick}
			className="w-full h-[3px] rounded-full bg-white/12 relative cursor-pointer overflow-hidden hover:h-[5px] transition-all"
		>
			<div
				className="absolute inset-y-0 left-0 bg-white rounded-full"
				style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
			/>
			<div
				className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] opacity-0 hover:opacity-100"
				style={{ left: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
			/>
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
