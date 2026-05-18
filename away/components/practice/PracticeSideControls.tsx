"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

export type PracticeHand = "both" | "left" | "right";

interface PracticeSideControlsProps {
	onSelectSong: () => void;
	autoPause: boolean;
	onToggleAutoPause: () => void;
	speed: number;
	onCycleSpeed: () => void;
	practiceHand: PracticeHand;
	onPracticeHandChange: (hand: PracticeHand) => void;
}

export function PracticeSideControls({
	onSelectSong,
	autoPause,
	onToggleAutoPause,
	speed,
	onCycleSpeed,
	practiceHand,
	onPracticeHandChange,
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
			{autoPause && (
				<div className="flex flex-col items-center gap-2">
					<Pill
						onClick={() => onPracticeHandChange(practiceHand === "left" ? "both" : "left")}
						active={practiceHand === "left"}
						label="Left hand"
						compact
					/>
					<Pill
						onClick={() => onPracticeHandChange(practiceHand === "right" ? "both" : "right")}
						active={practiceHand === "right"}
						label="Right hand"
						compact
					/>
				</div>
			)}
			<Pill onClick={onCycleSpeed} active={Math.abs(speed - 1) > 0.001} label={`Speed: ${formatSpeed(speed)}x`} />
		</div>
	);
}

function Pill({
	onClick,
	active,
	label,
	compact,
}: {
	onClick: () => void;
	active: boolean;
	label: string;
	compact?: boolean;
}) {
	return (
		<div onClick={onClick} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
			<DynamicLiquidGlass
				width={compact ? 200 : 250}
				height={compact ? 46 : 56}
				radius={15}
				refractionLevel={0.8}
				specularOpacity={0.7}
				glassBgOpacity={active ? 0.12 : 0.001}
			>
				<span
					className={`text-white tracking-wide pointer-events-none ${compact ? "text-sm font-normal" : "text-base font-medium"}`}
				>
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
