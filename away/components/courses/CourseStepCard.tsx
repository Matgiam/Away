// ============================================================================
// courses/CourseStepCard.tsx
// ----------------------------------------------------------------------------
// The "step info" card shown alongside every interactive course step.
// Contains the step title, body text, optional illustration, step progress
// (e.g. "3 of 12"), and the prev/next navigation buttons.
// ============================================================================

"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface CourseStepCardProps {
	courseTitle: string;
	stepIndex: number;
	totalSteps: number;
	title?: string;
	body: string;
	image?: string;
	imageAlt?: string;
	prompt?: string | null;
	canPrevious: boolean;
	canNext: boolean;
	completed: boolean;
	onPrevious: () => void;
	onNext: () => void;
}

export function CourseStepCard({
	courseTitle,
	stepIndex,
	totalSteps,
	title,
	body,
	image,
	imageAlt,
	prompt,
	canPrevious,
	canNext,
	completed,
	onPrevious,
	onNext,
}: CourseStepCardProps) {
	// Two-column layout when an image is present: image hero on the left, text on the right.
	// Same overall card height as the text-only variant so the visualiser lane behind it stays
	// at a consistent position — only difference is the layout becomes side-by-side.
	const cardHeight = image ? 320 : 220;
	return (
		<div className="pointer-events-none absolute top-7 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 select-none w-[min(960px,92vw)]">
			<div className="text-white text-2xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] mb-1">
				{courseTitle}
			</div>
			<div className="pointer-events-auto w-full">
				<DynamicLiquidGlass
					width={960}
					height={cardHeight}
					radius={22}
					refractionLevel={0.8}
					specularOpacity={0.55}
					glassBgOpacity={0.05}
				>
					<div className="flex h-full w-full flex-col p-5">
						<div className="flex w-full items-center justify-between text-white/55 text-xs italic tracking-widest uppercase shrink-0">
							<span>Step {stepIndex + 1} / {totalSteps}</span>
							{prompt && (
								<span className={`text-sm italic ${completed ? "text-emerald-300/80" : "text-white/70"}`}>
									{completed ? "✓ " : ""}
									{prompt}
								</span>
							)}
						</div>

						{image ? (
							<div className="flex flex-1 min-h-0 items-center gap-6 px-3 py-2">
								<div className="flex-1 min-w-0 min-h-0 h-full flex items-center justify-center">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={image}
										alt={imageAlt ?? ""}
										className="max-h-full max-w-full object-contain rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
									/>
								</div>
								<div className="flex-1 min-w-0 min-h-0 flex flex-col items-start justify-center gap-2 pr-2 overflow-hidden">
									{title && (
										<h2 className="text-white text-xl md:text-2xl font-semibold italic tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] text-left leading-tight">
											{title}
										</h2>
									)}
									<p className="text-white/85 text-[15px] md:text-base leading-relaxed whitespace-pre-line text-left">
										{body}
									</p>
									{imageAlt && (
										<span className="text-white/40 text-xs italic">{imageAlt}</span>
									)}
								</div>
							</div>
						) : (
							<div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center px-6">
								{title && (
									<h2 className="text-white text-lg md:text-xl font-semibold italic tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
										{title}
									</h2>
								)}
								<p className="text-white/85 text-sm md:text-[15px] leading-relaxed max-w-[720px] whitespace-pre-line">
									{body}
								</p>
							</div>
						)}

						<div className="flex w-full items-center justify-between gap-4 shrink-0">
							<NavButton
								onClick={onPrevious}
								disabled={!canPrevious}
								label="Previous"
							/>
							<NavButton
								onClick={onNext}
								disabled={!canNext}
								label="Next"
								highlight={completed}
							/>
						</div>
					</div>
				</DynamicLiquidGlass>
			</div>
		</div>
	);
}

function NavButton({
	onClick,
	disabled,
	label,
	highlight,
}: {
	onClick: () => void;
	disabled: boolean;
	label: string;
	highlight?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`transition-transform ${
				disabled ? "opacity-40 cursor-not-allowed" : "hover:scale-105 cursor-pointer"
			}`}
		>
			<DynamicLiquidGlass
				width={150}
				height={52}
				radius={14}
				refractionLevel={0.8}
				specularOpacity={0.7}
				glassBgOpacity={highlight && !disabled ? 0.18 : 0.04}
			>
				<span className={`text-base font-medium tracking-wide ${highlight && !disabled ? "text-white" : "text-white/85"}`}>
					{label}
				</span>
			</DynamicLiquidGlass>
		</button>
	);
}
