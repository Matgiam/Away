"use client";

export type PreviewButtonState = "idle" | "loading" | "playing";

interface PreviewButtonProps {
	state: PreviewButtonState;
	onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	size?: "sm" | "md";
}

export function PreviewButton({ state, onClick, size = "md" }: PreviewButtonProps) {
	const isActive = state !== "idle";
	const label =
		state === "loading"
			? "Loading preview…"
			: state === "playing"
				? "Stop preview"
				: "Play preview";
	const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
	const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
	const pauseIconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
	return (
		<button
			type="button"
			onClick={onClick}
			title={label}
			aria-label={label}
			className={`shrink-0 inline-flex items-center justify-center rounded-full border transition-colors ${dim} ${
				isActive
					? "border-violet-300/50 bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
					: "border-white/15 bg-white/5 text-white/80 hover:text-white hover:bg-white/10"
			}`}
		>
			{state === "loading" ? (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`${iconSize} animate-spin`}
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
			) : state === "playing" ? (
				<svg viewBox="0 0 24 24" fill="currentColor" className={pauseIconSize}>
					<rect x="6" y="5" width="4" height="14" rx="1" />
					<rect x="14" y="5" width="4" height="14" rx="1" />
				</svg>
			) : (
				<svg viewBox="0 0 24 24" fill="currentColor" className={`${iconSize} translate-x-[1px]`}>
					<path d="M8 5v14l11-7z" />
				</svg>
			)}
		</button>
	);
}
