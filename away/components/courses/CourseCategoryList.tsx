"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { COURSE_CATEGORIES, type CourseCategoryKey } from "@/lib/courses/types";

// UI-only filter type: extends the data CourseCategoryKey with an "all" pseudo
// category that shows every course regardless of its category field.
export type CourseCategoryFilter = CourseCategoryKey | "all";

export type CategoryStats = { completed: number; total: number };

interface CourseCategoryListProps {
	active: CourseCategoryFilter;
	onChange: (key: CourseCategoryFilter) => void;
	// Per-category completion counts. Categories not in the map render without a counter.
	stats?: Partial<Record<CourseCategoryFilter, CategoryStats>>;
}

const ITEMS: { key: CourseCategoryFilter; label: string }[] = [
	{ key: "all", label: "All" },
	...COURSE_CATEGORIES.map((c) => ({ key: c.key as CourseCategoryFilter, label: c.label })),
];

export function CourseCategoryList({ active, onChange, stats }: CourseCategoryListProps) {
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
					{ITEMS.map((item) => {
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
			</div>
		</DynamicLiquidGlass>
	);
}
