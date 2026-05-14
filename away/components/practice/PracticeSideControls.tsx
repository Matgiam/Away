"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface PracticeSideControlsProps {
	onSelectSong: () => void;
	autoPause: boolean;
	onToggleAutoPause: () => void;
	speed: number;
	onCycleSpeed: () => void;
}

export function PracticeSideControls({
	onSelectSong,
	autoPause,
	onToggleAutoPause,
	speed,
	onCycleSpeed,
}: PracticeSideControlsProps) {
	return (
		<div
			style={{ position: "absolute", top: "26%", right: "1%", zIndex: 50 }}
			className="flex flex-col items-center gap-4"
		>
			<Pill onClick={onSelectSong} active={false} label="Select song" />
			<Pill
				onClick={onToggleAutoPause}
				active={autoPause}
				label={`Auto-pause: ${autoPause ? "on" : "off"}`}
			/>
			<Pill onClick={onCycleSpeed} active={Math.abs(speed - 1) > 0.001} label={`Speed: ${formatSpeed(speed)}x`} />
		</div>
	);
}

function Pill({
	onClick,
	active,
	label,
}: {
	onClick: () => void;
	active: boolean;
	label: string;
}) {
	return (
		<div onClick={onClick} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
			<DynamicLiquidGlass
				width={250}
				height={56}
				radius={15}
				refractionLevel={0.8}
				specularOpacity={0.7}
				glassBgOpacity={active ? 0.12 : 0.001}
			>
				<span className="text-white font-medium tracking-wide text-base pointer-events-none">
					{label}
				</span>
			</DynamicLiquidGlass>
		</div>
	);
}

function formatSpeed(speed: number): string {
	if (Number.isInteger(speed)) return speed.toFixed(1);
	return speed.toString();
}
