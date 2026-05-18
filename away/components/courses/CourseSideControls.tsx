"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface CourseSideControlsProps {
	onSelectCourse: () => void;
	onReplayStep: () => void;
	canReplay: boolean;
	demoMode?: boolean;
	demoLabel?: string;
	onDemo?: () => void;
}

export function CourseSideControls({
	onSelectCourse,
	onReplayStep,
	canReplay,
	demoMode,
	demoLabel,
	onDemo,
}: CourseSideControlsProps) {
	return (
		<div
			style={{ position: "absolute", top: "30%", right: "1%", zIndex: 50 }}
			className="flex flex-col items-center gap-4"
		>
			<Pill onClick={onSelectCourse} active={false} label="Select course" />
			<Pill onClick={onReplayStep} active={false} label="Replay step" disabled={!canReplay} />
			{demoMode && onDemo && (
				<Pill onClick={onDemo} active={true} label={demoLabel ?? "Play demo"} />
			)}
		</div>
	);
}

function Pill({
	onClick,
	active,
	label,
	disabled,
}: {
	onClick: () => void;
	active: boolean;
	label: string;
	disabled?: boolean;
}) {
	return (
		<div
			onClick={disabled ? undefined : onClick}
			className={disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
			style={{ pointerEvents: "auto" }}
		>
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
