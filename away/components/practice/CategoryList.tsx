"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SongCategoryGroup, SongCategoryKey } from "@/lib/practice/songs";

export type CategoryFilter = SongCategoryKey | "training" | "custom";

interface CategoryListProps {
	categories: SongCategoryGroup[];
	active: CategoryFilter;
	onChange: (key: CategoryFilter) => void;
	showTraining?: boolean;
	showCustom?: boolean;
	counts?: Partial<Record<CategoryFilter, number>>;
}

export function CategoryList({
	categories,
	active,
	onChange,
	showTraining = true,
	showCustom = true,
	counts,
}: CategoryListProps) {
	const items: { key: CategoryFilter; label: string }[] = [
		...categories.map((c) => ({ key: c.key as CategoryFilter, label: c.label })),
	];
	if (showTraining) items.push({ key: "training", label: "Training" });
	if (showCustom) items.push({ key: "custom", label: "Custom" });

	return (
		<DynamicLiquidGlass width={300} height={310} radius={20} refractionLevel={0.7} specularOpacity={0.5} glassBgOpacity={0.03}>
			<div className="flex h-full w-full flex-col justify-center px-7 py-6 gap-3">
				{items.map((item) => {
					const isActive = item.key === active;
					const count = counts?.[item.key];
					return (
						<button
							key={item.key}
							onClick={() => onChange(item.key)}
							className={`group relative flex items-center justify-between text-left transition-all ${
								isActive ? "text-white" : "text-white/45 hover:text-white/80"
							}`}
						>
							<span
								className={`absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-white transition-opacity ${
									isActive ? "opacity-100" : "opacity-0"
								}`}
							/>
							<span className="italic text-lg tracking-wide">{item.label}</span>
							{typeof count === "number" && (
								<span
									className={`text-xs tabular-nums ${
										isActive ? "text-white/70" : "text-white/30 group-hover:text-white/55"
									}`}
								>
									{count}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</DynamicLiquidGlass>
	);
}
