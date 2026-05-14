"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryList, type CategoryFilter } from "./CategoryList";
import { SearchBar } from "./SearchBar";
import { SongList } from "./SongList";
import { StartButton } from "./StartButton";
import { PracticeTabs, type PracticeTab } from "./PracticeTabs";
import { SONG_CATEGORIES, type BuiltInSong } from "@/lib/practice/songs";

interface PracticeMenuProps {
	initialSongs: BuiltInSong[];
}

export function PracticeMenu({ initialSongs }: PracticeMenuProps) {
	const router = useRouter();

	const [tab, setTab] = useState<PracticeTab>("songs");
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CategoryFilter>("popular");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const counts = useMemo(() => {
		const result: Record<string, number> = {};
		for (const song of initialSongs) {
			result[song.category] = (result[song.category] ?? 0) + 1;
		}
		return result;
	}, [initialSongs]);

	const filteredSongs = useMemo(() => {
		const term = search.trim().toLowerCase();
		return initialSongs.filter((song) => {
			if (category !== "training" && category !== "custom" && song.category !== category) return false;
			if (category === "training" || category === "custom") return false;
			if (!term) return true;
			const hay = [song.title, song.artist ?? "", song.subcategoryLabel ?? ""].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [initialSongs, category, search]);

	useEffect(() => {
		if (filteredSongs.length === 0) {
			setSelectedId(null);
			return;
		}
		if (!filteredSongs.find((s) => s.id === selectedId)) {
			setSelectedId(filteredSongs[0].id);
		}
	}, [filteredSongs, selectedId]);

	const handlePlay = (song: BuiltInSong) => {
		router.push(`/practice/play/${encodeURIComponent(song.id)}`);
	};

	const handleStart = () => {
		const song = filteredSongs.find((s) => s.id === selectedId);
		if (song) handlePlay(song);
	};

	const handleTabChange = (next: PracticeTab) => {
		setTab(next);
		if (next === "import") {
			setCategory("custom");
		}
	};

	const emptyMessage =
		category === "training"
			? "Courses are coming soon."
			: category === "custom"
				? "Upload a MIDI file to get started."
				: undefined;

	return (
		<div className="flex h-full w-full flex-col px-12 pt-10 pb-12 gap-10">
			<header className="flex items-start justify-between gap-6">
				<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
					Select your song
				</h1>
				<PracticeTabs active={tab} onChange={handleTabChange} />
			</header>

			<div className="grid grid-cols-[300px_1fr] gap-12 flex-1 min-h-0">
				<div className="flex flex-col items-start gap-7">
					<SearchBar value={search} onChange={setSearch} />
					<CategoryList
						categories={SONG_CATEGORIES}
						active={category}
						onChange={setCategory}
						counts={counts as Partial<Record<CategoryFilter, number>>}
					/>
					<StartButton onClick={handleStart} disabled={!selectedId || filteredSongs.length === 0} />
				</div>

				<div className="min-h-0">
					{category === "training" || category === "custom" ? (
						<div className="flex h-full w-full items-center justify-center text-white/50 italic text-lg">
							{emptyMessage}
						</div>
					) : (
						<SongList
							songs={filteredSongs}
							selectedId={selectedId}
							onSelect={(song) => setSelectedId(song.id)}
							onPlay={handlePlay}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
