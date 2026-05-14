"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SongCategoryKey } from "@/lib/practice/songs";

export type CategoryFilter = SongCategoryKey | "training" | "custom";

interface CategoryListProps {
	active: CategoryFilter;
	onChange: (key: CategoryFilter) => void;
}

const CATEGORY_ITEMS: { key: CategoryFilter; label: string }[] = [
	{ key: "video_games", label: "Video Game" },
	{ key: "anime", label: "Anime" },
	{ key: "popular", label: "Pop" },
	{ key: "classical", label: "Classical" },
	{ key: "training", label: "Training" },
	{ key: "custom", label: "Custom" },
];

export function CategoryList({ active, onChange }: CategoryListProps) {
	return (
		<DynamicLiquidGlass
			width={300}
			height={320}
			radius={20}
			refractionLevel={0.7}
			specularOpacity={0.5}
			glassBgOpacity={0.03}
		>
			<div className="flex h-full w-full flex-col justify-center px-8 py-6 gap-4">
				{CATEGORY_ITEMS.map((item) => {
					const isActive = item.key === active;
					return (
						<button
							key={item.key}
							onClick={() => onChange(item.key)}
							className={`group relative flex items-center text-left transition-all ${
								isActive ? "text-white" : "text-white/45 hover:text-white/80"
							}`}
						>
							<span
								className={`absolute -left-4 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-white transition-opacity ${
									isActive ? "opacity-100" : "opacity-0"
								}`}
							/>
							<span className="italic text-xl tracking-wide">{item.label}</span>
						</button>
					);
				})}
			</div>
		</DynamicLiquidGlass>
	);
}
