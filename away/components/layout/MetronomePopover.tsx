"use client";

import { useEffect, useRef } from "react";

interface MetronomePopoverProps {
	open: boolean;
	onClose: () => void;
	enabled: boolean;
	onEnabledChange: (v: boolean) => void;
	bpm: number;
	onBpmChange: (v: number) => void;
	beatsPerBar: number;
	onBeatsPerBarChange: (v: number) => void;
	volume: number;
	onVolumeChange: (v: number) => void;
	// Element to anchor the popover to (positions it just below)
	anchorRect: DOMRect | null;
}

const BEATS_OPTIONS = [2, 3, 4, 6];

export function MetronomePopover({
	open,
	onClose,
	enabled,
	onEnabledChange,
	bpm,
	onBpmChange,
	beatsPerBar,
	onBeatsPerBarChange,
	volume,
	onVolumeChange,
	anchorRect,
}: MetronomePopoverProps) {
	const popRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDocDown = (e: MouseEvent) => {
			if (!popRef.current) return;
			if (popRef.current.contains(e.target as Node)) return;
			// Click on the anchor itself is handled by the parent — ignore for closing
			onClose();
		};
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		// Defer so the opening click doesn't immediately close us
		const t = window.setTimeout(() => {
			document.addEventListener("mousedown", onDocDown);
			document.addEventListener("keydown", onEsc);
		}, 0);
		return () => {
			window.clearTimeout(t);
			document.removeEventListener("mousedown", onDocDown);
			document.removeEventListener("keydown", onEsc);
		};
	}, [open, onClose]);

	if (!open) return null;

	const popWidth = 320;
	const top = anchorRect ? anchorRect.bottom + 10 : 100;
	const right = anchorRect ? Math.max(16, window.innerWidth - anchorRect.right) : 16;

	return (
		<div
			ref={popRef}
			className="fixed z-[120] rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl"
			style={{ top, right, width: popWidth }}
		>
			<div className="flex flex-col px-6 pt-5 pb-6">
				<div className="flex items-center justify-between mb-4">
					<span className="text-white/40 text-xs italic tracking-[0.25em] uppercase">
						Metronome
					</span>
					<Toggle value={enabled} onChange={onEnabledChange} />
				</div>

				<div className="flex items-baseline justify-between mb-1.5">
					<span className="text-white/55 text-xs italic tracking-wider uppercase">Tempo</span>
					<span className="text-white text-2xl font-light italic tabular-nums">
						{bpm}
						<span className="text-white/40 text-xs italic ml-1.5 tracking-wider">BPM</span>
					</span>
				</div>
				<div className="flex items-center gap-3 mb-5">
					<StepButton onClick={() => onBpmChange(Math.max(20, bpm - 1))} label="−" />
					<input
						type="range"
						min={40}
						max={240}
						step={1}
						value={bpm}
						onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
						className="flex-1 metronome-slider"
					/>
					<StepButton onClick={() => onBpmChange(Math.min(240, bpm + 1))} label="+" />
				</div>

				<span className="text-white/55 text-xs italic tracking-wider uppercase mb-2 block">
					Beats per bar
				</span>
				<div className="flex items-center gap-2 mb-5">
					{BEATS_OPTIONS.map((n) => {
						const active = n === beatsPerBar;
						return (
							<button
								key={n}
								type="button"
								onClick={() => onBeatsPerBarChange(n)}
								className={`flex-1 px-3 py-2 rounded-lg italic text-sm tracking-wide transition-colors border ${
									active
										? "bg-[#5c0091] border-[#5c0091] text-white"
										: "border-white/15 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08]"
								}`}
							>
								{n}/4
							</button>
						);
					})}
				</div>

				<div className="flex items-baseline justify-between mb-1.5">
					<span className="text-white/55 text-xs italic tracking-wider uppercase">Volume</span>
					<span className="text-white/70 text-xs italic tabular-nums">{volume}%</span>
				</div>
				<input
					type="range"
					min={0}
					max={100}
					step={1}
					value={volume}
					onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
					className="w-full metronome-slider"
				/>
			</div>

			<style jsx>{`
				:global(.metronome-slider) {
					appearance: none;
					-webkit-appearance: none;
					height: 4px;
					background: rgba(255, 255, 255, 0.12);
					border-radius: 999px;
					outline: none;
				}
				:global(.metronome-slider::-webkit-slider-thumb) {
					appearance: none;
					-webkit-appearance: none;
					width: 14px;
					height: 14px;
					border-radius: 50%;
					background: #c75ad6;
					cursor: pointer;
					border: none;
				}
				:global(.metronome-slider::-moz-range-thumb) {
					width: 14px;
					height: 14px;
					border-radius: 50%;
					background: #c75ad6;
					cursor: pointer;
					border: none;
				}
			`}</style>
		</div>
	);
}

function StepButton({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-8 h-8 rounded-lg border border-white/15 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors italic text-sm leading-none flex items-center justify-center shrink-0"
		>
			{label}
		</button>
	);
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={value}
			onClick={() => onChange(!value)}
			className={`relative w-12 h-6 rounded-full transition-colors shrink-0 p-0 border-0 cursor-pointer ${
				value ? "bg-[#5c0091]" : "bg-white/10 ring-1 ring-inset ring-white/15"
			}`}
		>
			<span
				className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full bg-white transition-transform ${
					value ? "translate-x-[24px]" : "translate-x-0"
				}`}
			/>
		</button>
	);
}
