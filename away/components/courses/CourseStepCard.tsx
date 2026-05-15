"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface CourseStepCardProps {
	stepIndex: number;
	totalSteps: number;
	title?: string;
	body: string;
	prompt?: string | null;
	canPrevious: boolean;
	canNext: boolean;
	completed: boolean;
	onPrevious: () => void;
	onNext: () => void;
}

export function CourseStepCard({
	stepIndex,
	totalSteps,
	title,
	body,
	prompt,
	canPrevious,
	canNext,
	completed,
	onPrevious,
	onNext,
}: CourseStepCardProps) {
	return (
		<div className="pointer-events-none absolute top-7 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 select-none w-[min(900px,90vw)]">
			<div className="pointer-events-auto w-full">
				<DynamicLiquidGlass
					width={900}
					height={260}
					radius={22}
					refractionLevel={0.8}
					specularOpacity={0.55}
					glassBgOpacity={0.05}
				>
					<div className="flex h-full w-full flex-col items-center justify-between p-6">
						<div className="flex w-full items-center justify-between text-white/55 text-xs italic tracking-widest uppercase">
							<span>Step {stepIndex + 1} / {totalSteps}</span>
							{prompt && (
								<span className={`text-sm italic ${completed ? "text-emerald-300/80" : "text-white/70"}`}>
									{completed ? "✓ " : ""}
									{prompt}
								</span>
							)}
						</div>

						<div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center px-6">
							{title && (
								<h2 className="text-white text-xl md:text-2xl font-semibold italic tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
									{title}
								</h2>
							)}
							<p className="text-white/85 text-sm md:text-base leading-relaxed max-w-[700px] whitespace-pre-line">
								{body}
							</p>
						</div>

						<div className="flex w-full items-center justify-between gap-4">
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
