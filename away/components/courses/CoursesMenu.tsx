"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTabs, type PracticeTab } from "@/components/practice/PracticeTabs";
import { SearchBar } from "@/components/practice/SearchBar";
import { StartButton } from "@/components/practice/StartButton";
import { CourseCategoryList } from "./CourseCategoryList";
import { CourseList } from "./CourseList";
import type { Course, CourseCategoryKey } from "@/lib/courses/types";

interface CoursesMenuProps {
	courses: Course[];
}

export function CoursesMenu({ courses }: CoursesMenuProps) {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CourseCategoryKey>("intro");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return courses.filter((course) => {
			if (course.category !== category) return false;
			if (!term) return true;
			const hay = [course.title, course.description].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [courses, category, search]);

	useEffect(() => {
		if (filtered.length === 0) {
			setSelectedId(null);
			return;
		}
		if (!filtered.find((c) => c.id === selectedId)) {
			setSelectedId(filtered[0].id);
		}
	}, [filtered, selectedId]);

	const handleTabChange = (next: PracticeTab) => {
		if (next === "songs" || next === "import") {
			router.push("/practice");
			return;
		}
	};

	const handlePlay = (course: Course) => {
		router.push(`/practice/courses/${encodeURIComponent(course.id)}`);
	};

	const handleStart = () => {
		if (!selectedId) return;
		router.push(`/practice/courses/${encodeURIComponent(selectedId)}`);
	};

	return (
		<div className="h-full w-full">
			<div className="mx-auto max-w-[1200px] h-full flex flex-col gap-12 px-1 pt-12 pb-12">
				<header className="flex items-start justify-between gap-12">
					<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
						Select your course
					</h1>
					<PracticeTabs active="courses" onChange={handleTabChange} />
				</header>

				<div className="grid grid-cols-[300px_1fr] gap-30 flex-1 min-h-0">
					<div className="flex flex-col items-start gap-7">
						<SearchBar value={search} onChange={setSearch} placeholder="Search your course" />
						<CourseCategoryList active={category} onChange={setCategory} />
						<StartButton onClick={handleStart} disabled={!selectedId} />
					</div>

					<div className="min-h-0 overflow-hidden">
						<CourseList
							courses={filtered}
							selectedId={selectedId}
							onSelect={(course) => setSelectedId(course.id)}
							onPlay={handlePlay}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
