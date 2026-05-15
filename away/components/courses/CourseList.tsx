"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { Course } from "@/lib/courses/types";

interface CourseListProps {
	courses: Course[];
	selectedId: string | null;
	onSelect: (course: Course) => void;
	onPlay: (course: Course) => void;
	emptyMessage?: string;
}

export function CourseList({ courses, selectedId, onSelect, onPlay, emptyMessage }: CourseListProps) {
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
							<div className="flex h-full w-full items-center justify-center px-7">
								<span
									className={`text-xl italic font-semibold tracking-wide text-center ${
										isSelected ? "text-white" : "text-white/80"
									}`}
								>
									{course.title}
								</span>
							</div>
						</DynamicLiquidGlass>
					</button>
				);
			})}
		</div>
	);
}
