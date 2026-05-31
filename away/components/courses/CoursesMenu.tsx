"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { PracticeTabs, type PracticeTab } from "@/components/practice/PracticeTabs";
import { SearchBar } from "@/components/practice/SearchBar";
import { StartButton } from "@/components/practice/StartButton";
import { CourseCategoryList, type CategoryStats, type CourseCategoryFilter } from "./CourseCategoryList";
import { CourseList } from "./CourseList";
import {
	ACHIEVEMENT_UNLOCK_EVENT,
	getCompletedCourses,
} from "@/lib/achievements";
import type { Course } from "@/lib/courses/types";

interface CoursesMenuProps {
	courses: Course[];
}

const COURSES_CATEGORY_KEY = "away:courses-category";
const COURSES_SELECTED_KEY = "away:courses-selected-id";

const PERSISTABLE_COURSE_CATEGORIES: ReadonlySet<string> = new Set<CourseCategoryFilter>([
	"all",
	"intro",
	"scales",
	"hand_independence",
	"chords",
	"intervals",
	"ear_training",
	"improvisation",
]);

export function CoursesMenu({ courses }: CoursesMenuProps) {
	const router = useAppRouter();

	// Prefetch the sibling tab so switching feels instant.
	useEffect(() => {
		router.prefetch("/practice");
	}, [router]);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CourseCategoryFilter>("all");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [completedIds, setCompletedIds] = useState<string[]>(() => getCompletedCourses());

	// Two-phase restore from localStorage so we land where the user left off.
	// hydrated gates both the save effects (avoid overwriting saved values with
	// defaults) and the "keep selection valid" effect (avoid snapping to the
	// first item before restore has applied).
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const savedCat = window.localStorage.getItem(COURSES_CATEGORY_KEY);
			const savedId = window.localStorage.getItem(COURSES_SELECTED_KEY);
			if (savedCat && PERSISTABLE_COURSE_CATEGORIES.has(savedCat)) {
				setCategory(savedCat as CourseCategoryFilter);
			}
			if (savedId) setSelectedId(savedId);
		} catch {}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated || typeof window === "undefined") return;
		try {
			window.localStorage.setItem(COURSES_CATEGORY_KEY, category);
		} catch {}
	}, [hydrated, category]);

	useEffect(() => {
		if (!hydrated || typeof window === "undefined") return;
		try {
			if (selectedId) window.localStorage.setItem(COURSES_SELECTED_KEY, selectedId);
			else window.localStorage.removeItem(COURSES_SELECTED_KEY);
		} catch {}
	}, [hydrated, selectedId]);

	// Pick up new completions if the user finishes a course while this page is mounted.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const refresh = () => setCompletedIds(getCompletedCourses());
		window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, refresh);
		// Also refresh when the user returns to the tab (eg. from the course player).
		const onVisible = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, refresh);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, []);

	const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return courses.filter((course) => {
			if (category !== "all" && course.category !== category) return false;
			if (!term) return true;
			const hay = [course.title, course.description].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [courses, category, search]);

	// Per-category {completed, total} stats for the sidebar.
	const categoryStats = useMemo<Partial<Record<CourseCategoryFilter, CategoryStats>>>(() => {
		const out: Partial<Record<CourseCategoryFilter, CategoryStats>> = {};
		for (const c of courses) {
			const stats = out[c.category] ?? { completed: 0, total: 0 };
			stats.total += 1;
			if (completedSet.has(c.id)) stats.completed += 1;
			out[c.category] = stats;
		}
		// "All" sums everything — matches filtered's scope when category === "all".
		out["all"] = {
			total: courses.length,
			completed: courses.reduce((n, c) => n + (completedSet.has(c.id) ? 1 : 0), 0),
		};
		return out;
	}, [courses, completedSet]);

	const totalStats = useMemo(() => {
		const total = courses.length;
		const completed = courses.reduce((n, c) => n + (completedSet.has(c.id) ? 1 : 0), 0);
		return { completed, total };
	}, [courses, completedSet]);

	useEffect(() => {
		if (!hydrated) return;
		if (filtered.length === 0) {
			setSelectedId(null);
			return;
		}
		if (!filtered.find((c) => c.id === selectedId)) {
			setSelectedId(filtered[0].id);
		}
	}, [hydrated, filtered, selectedId]);

	// Prefetch the currently-selected course's player page so hitting Start (or double-click)
	// feels instant.
	useEffect(() => {
		if (!selectedId) return;
		router.prefetch(`/practice/courses/${encodeURIComponent(selectedId)}`);
	}, [router, selectedId]);

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
			<div
				className="mx-auto h-full flex flex-col"
				style={{
					maxWidth: "min(62.5vw, 1200px)",
					gap: "min(2.5vw, 48px)",
					paddingLeft: "min(0.1vw, 2px)",
					paddingRight: "min(0.1vw, 2px)",
					paddingTop: "min(2.5vw, 48px)",
					paddingBottom: "min(2.5vw, 48px)",
				}}
			>
				<header className="flex items-start justify-between gap-12">
					<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
						Select your course
					</h1>
					<PracticeTabs active="courses" onChange={handleTabChange} />
				</header>

				<div
					className="grid flex-1 min-h-0"
					style={{
						gridTemplateColumns: "min(15.6vw, 300px) 1fr",
						columnGap: "min(5vw, 96px)",
					}}
				>
					<div className="flex flex-col items-start gap-7">
						<SearchBar value={search} onChange={setSearch} placeholder="Search your course" />
						<CourseCategoryList
							active={category}
							onChange={setCategory}
							stats={categoryStats}
							totalStats={totalStats}
						/>
						<StartButton onClick={handleStart} disabled={!selectedId} />
					</div>

					<div className="min-h-0 overflow-hidden">
						<CourseList
							courses={filtered}
							selectedId={selectedId}
							completedIds={completedSet}
							onSelect={(course) => setSelectedId(course.id)}
							onPlay={handlePlay}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
