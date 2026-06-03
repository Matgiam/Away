// ============================================================================
// courses/CourseList.tsx
// ----------------------------------------------------------------------------
// Card grid of courses inside the CoursesMenu. Each card shows the title,
// estimated minutes, a completion check, and double-click play behaviour.
// ============================================================================

"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { Course } from "@/lib/courses/types";

interface CourseListProps {
	courses: Course[];
	selectedId: string | null;
	completedIds?: ReadonlySet<string>;
	onSelect: (course: Course) => void;
	onPlay: (course: Course) => void;
	emptyMessage?: string;
}

function CheckBadge() {
	return (
		<span
			className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full border border-emerald-300/40 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_rgba(120,220,160,0.18)]"
			aria-label="Completed"
			title="Completed"
		>
			<svg
				viewBox="0 0 20 20"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-3.5 h-3.5"
			>
				<path d="M5 10.5l3.2 3.2L15 7" />
			</svg>
		</span>
	);
}

export function CourseList({
	courses,
	selectedId,
	completedIds,
	onSelect,
	onPlay,
	emptyMessage,
}: CourseListProps) {
	if (courses.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center text-white/50 italic">
				{emptyMessage ?? "No courses in this category yet."}
			</div>
		);
	}

	return (
		<div className="practice-song-list h-full w-full overflow-y-auto pr-4 flex flex-col gap-3">
			{courses.map((course) => {
				const isSelected = course.id === selectedId;
				const isCompleted = !!completedIds?.has(course.id);
				return (
					<button
						key={course.id}
						onClick={() => onSelect(course)}
						onDoubleClick={() => onPlay(course)}
						className="block transition-transform hover:scale-[1.005]"
					>
						<DynamicLiquidGlass
							width={680}
							height={76}
							radius={14}
							refractionLevel={0.7}
							specularOpacity={0.55}
							glassBgOpacity={isSelected ? 0.12 : 0.02}
						>
							<div className="relative flex h-full w-full items-center justify-center px-7">
								<span
									className={`text-xl italic font-semibold tracking-wide text-center ${
										isSelected ? "text-white" : "text-white/80"
									}`}
								>
									{course.title}
								</span>
								{isCompleted && <CheckBadge />}
							</div>
						</DynamicLiquidGlass>
					</button>
				);
			})}
		</div>
	);
}
