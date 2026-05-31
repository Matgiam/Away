"use client";

import type { ReactNode } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

export type PracticeHand = "both" | "left" | "right";

interface PracticeControlsConfig {
	onSelectSong: () => void;
	autoPause: boolean;
	onToggleAutoPause: () => void;
	speed: number;
	onCycleSpeed: () => void;
	practiceHand: PracticeHand;
	onPracticeHandChange: (hand: PracticeHand) => void;
}

// Returns a flat list of 67×67 button nodes for the practice player's right-
// side nav. Returned as an array (not a wrapping <div>) so the Navigation can
// drop them into individual grid cells alongside the existing icons and the
// metronome button — that's what makes the metronome end up on row 2 next to
// the first two practice controls instead of on its own row.
export function buildPracticeControls(props: PracticeControlsConfig): ReactNode[] {
	const buttons: ReactNode[] = [
		<SquareButton
			key="auto-pause"
			onClick={props.onToggleAutoPause}
			active={props.autoPause}
			title={`Auto-pause: ${props.autoPause ? "on" : "off"}`}
			indicatorOn={props.autoPause}
		>
			{/* The icon reflects what clicking the button will DO next: when
			    auto-pause is currently ON, clicking releases the gate (play
			    icon); when OFF, clicking will start gating (pause icon). */}
			{props.autoPause ? <PlayIcon /> : <PauseIcon />}
		</SquareButton>,
	];

	if (props.autoPause) {
		buttons.push(
			<SquareButton
				key="lh"
				onClick={() => props.onPracticeHandChange(props.practiceHand === "left" ? "both" : "left")}
				active={props.practiceHand === "left"}
				title="Practice with left hand"
			>
				<HandLabel text="LH" />
			</SquareButton>,
			<SquareButton
				key="rh"
				onClick={() => props.onPracticeHandChange(props.practiceHand === "right" ? "both" : "right")}
				active={props.practiceHand === "right"}
				title="Practice with right hand"
			>
				<HandLabel text="RH" />
			</SquareButton>,
		);
	}

	buttons.push(
		<SquareButton
			key="speed"
			onClick={props.onCycleSpeed}
			active={Math.abs(props.speed - 1) > 0.001}
			title={`Speed: ${formatSpeed(props.speed)}× — click to cycle`}
		>
			<SpeedLabel speed={props.speed} />
		</SquareButton>,
	);

	return buttons;
}

function SquareButton({
	onClick,
	active,
	title,
	children,
	indicatorOn,
}: {
	onClick: () => void;
	active: boolean;
	title: string;
	children: ReactNode;
	indicatorOn?: boolean;
}) {
	return (
		<div
			onClick={onClick}
			className="cursor-pointer relative transition-transform duration-150 ease-out hover:scale-105"
			style={{ pointerEvents: "auto" }}
			title={title}
		>
			<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={active ? 0.15 : 0.001}>
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

function PauseIcon() {
	return (
		<svg width="28" height="28" viewBox="0 0 24 24" fill="white" className="pointer-events-none">
			<rect x="6" y="5" width="4" height="14" rx="1.2" />
			<rect x="14" y="5" width="4" height="14" rx="1.2" />
		</svg>
	);
}

function PlayIcon() {
	return (
		<svg width="28" height="28" viewBox="0 0 24 24" fill="white" className="pointer-events-none">
			<path d="M8 5v14l11-7L8 5Z" />
		</svg>
	);
}

function HandLabel({ text }: { text: string }) {
	return <span className="text-white font-semibold tracking-wide text-base pointer-events-none">{text}</span>;
}

function SpeedLabel({ speed }: { speed: number }) {
	return <span className="text-white font-semibold tracking-tight text-base pointer-events-none tabular-nums">{formatSpeed(speed)}×</span>;
}

function formatSpeed(speed: number): string {
	if (Number.isInteger(speed)) return speed.toFixed(1);
	return speed.toString();
}
