"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { COURSE_CATEGORIES, type CourseCategoryKey } from "@/lib/courses/types";

interface CourseCategoryListProps {
	active: CourseCategoryKey;
	onChange: (key: CourseCategoryKey) => void;
}

export function CourseCategoryList({ active, onChange }: CourseCategoryListProps) {
	return (
		<DynamicLiquidGlass
			width={300}
			height={360}
			radius={20}
			refractionLevel={0.7}
			specularOpacity={0.5}
			glassBgOpacity={0.03}
		>
			<div className="flex h-full w-full flex-col justify-center px-8 py-6 gap-4">
				{COURSE_CATEGORIES.map((item) => {
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
								className={`absolute -left-4 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#5C0091] transition-opacity ${
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
