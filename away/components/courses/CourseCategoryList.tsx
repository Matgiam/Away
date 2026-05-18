"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { COURSE_CATEGORIES, type CourseCategoryKey } from "@/lib/courses/types";

export type CategoryStats = { completed: number; total: number };

interface CourseCategoryListProps {
	active: CourseCategoryKey;
	onChange: (key: CourseCategoryKey) => void;
	// Per-category completion counts. Categories not in the map render without a counter.
	stats?: Partial<Record<CourseCategoryKey, CategoryStats>>;
	// Overall completion shown at the bottom-right of the panel.
	totalStats?: CategoryStats;
}

export function CourseCategoryList({ active, onChange, stats, totalStats }: CourseCategoryListProps) {
	return (
		<DynamicLiquidGlass
			width={300}
			height={400}
			radius={20}
			refractionLevel={0.7}
			specularOpacity={0.5}
			glassBgOpacity={0.03}
		>
			<div className="relative flex h-full w-full flex-col px-8 py-6">
				<div className="flex flex-1 flex-col justify-center gap-4">
					{COURSE_CATEGORIES.map((item) => {
						const isActive = item.key === active;
						const s = stats?.[item.key];
						const allDone = s && s.total > 0 && s.completed >= s.total;
						return (
							<button
								key={item.key}
								onClick={() => onChange(item.key)}
								className={`group relative flex items-center justify-between gap-3 text-left transition-all ${
									isActive ? "text-white" : "text-white/45 hover:text-white/80"
								}`}
							>
								<span
									className={`absolute -left-4 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#5C0091] transition-opacity ${
										isActive ? "opacity-100" : "opacity-0"
									}`}
								/>
								<span className="italic text-xl tracking-wide">{item.label}</span>
								{s && (
									<span
										className={`italic text-sm tabular-nums tracking-wide shrink-0 ${
											allDone ? "text-emerald-300/85" : isActive ? "text-white/65" : "text-white/35"
										}`}
									>
										{s.completed}/{s.total}
									</span>
								)}
							</button>
						);
					})}
				</div>

				{totalStats && totalStats.total > 0 && (
					<div className="flex items-center justify-end pt-3 pr-1">
						<span
							className={`italic text-xs tabular-nums tracking-wider ${
								totalStats.completed >= totalStats.total
									? "text-emerald-300/85"
									: "text-white/45"
							}`}
						>
							{totalStats.completed}/{totalStats.total}
						</span>
					</div>
				)}
			</div>
		</DynamicLiquidGlass>
	);
}
