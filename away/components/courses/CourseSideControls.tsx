// ============================================================================
// courses/CourseSideControls.tsx
// ----------------------------------------------------------------------------
// Course-mode controls rendered inside the global Navigation's `extraControls`
// strip. Square liquid-glass buttons (Select course, Replay step, Replay demo)
// matching the style used by the practice player — replaces the old floating
// pill panel that used to sit beside the course player.
// ============================================================================

"use client";

import type { ReactNode } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { useResponsiveNavSize } from "@/hooks/useResponsiveNavSize";

interface CourseControlsConfig {
	onReplayStep: () => void;
	canReplay: boolean;
}

// Returns a flat list of square buttons for Navigation's right strip. Returned
// as an array (not a wrapper) so they slot into the metronome-row grid the
// same way buildPracticeControls() does.
//
// Currently surfaces only "Replay step". The earlier "Select course" (books)
// and "Replay demo" (play) buttons were removed at user request — back-to-list
// is reachable via the exit icon, and demos auto-play when each step opens
// so a manual replay control was redundant.
export function buildCourseControls(props: CourseControlsConfig): ReactNode[] {
	return [
		<SquareButton
			key="replay-step"
			onClick={props.onReplayStep}
			active={false}
			disabled={!props.canReplay}
			title="Replay this step from the beginning"
		>
			<ReplayIcon />
		</SquareButton>,
	];
}

function SquareButton({
	onClick,
	active,
	disabled,
	title,
	children,
	indicatorOn,
}: {
	onClick: () => void;
	active: boolean;
	disabled?: boolean;
	title: string;
	children: ReactNode;
	indicatorOn?: boolean;
}) {
	// Calling the hook here (not inside buildCourseControls) keeps the builder
	// itself a plain function, so it can be called from render bodies without
	// triggering React's "hooks called conditionally" lint when a parent
	// optionally includes the demo button.
	const navSize = useResponsiveNavSize();
	return (
		<div
			onClick={disabled ? undefined : onClick}
			className={`relative transition-transform duration-150 ease-out hover:scale-105 ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
			style={{ pointerEvents: "auto" }}
			title={title}
		>
			<DynamicLiquidGlass
				width={navSize.button}
				height={navSize.button}
				radius={15}
				refractionLevel={0.8}
				specularOpacity={0.7}
				glassBgOpacity={active ? 0.15 : 0.001}
			>
				{children}
			</DynamicLiquidGlass>
			{indicatorOn && (
				<span
					className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c75ad6] shadow-[0_0_8px_rgba(199,90,214,0.8)] pointer-events-none"
					aria-hidden
				/>
			)}
		</div>
	);
}

// "Replay step" — circular arrow restart.
function ReplayIcon() {
	return (
		<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
			<path d="M3 12a9 9 0 1 0 3-6.7" />
			<polyline points="3 4 3 8 7 8" />
		</svg>
	);
}
