"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryList, type CategoryFilter } from "./CategoryList";
import { SearchBar } from "./SearchBar";
import { SongList } from "./SongList";
import { StartButton } from "./StartButton";
import { PracticeTabs, type PracticeTab } from "./PracticeTabs";
import { UploadModal } from "./UploadModal";
import { UploadsView } from "./UploadsView";
import type { BuiltInSong } from "@/lib/practice/songs";
import {
	deleteUploadedSong,
	listUploadedSongs,
	type UploadedSongMeta,
} from "@/lib/practice/uploads";

interface PracticeMenuProps {
	initialSongs: BuiltInSong[];
}

export function PracticeMenu({ initialSongs }: PracticeMenuProps) {
	const router = useRouter();

	const [tab, setTab] = useState<PracticeTab>("songs");
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CategoryFilter>("popular");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const [uploads, setUploads] = useState<UploadedSongMeta[]>([]);
	const [uploadsLoading, setUploadsLoading] = useState(true);
	const [uploadModalOpen, setUploadModalOpen] = useState(false);

	const refreshUploads = useCallback(async () => {
		setUploadsLoading(true);
		try {
			const rows = await listUploadedSongs();
			setUploads(rows);
		} catch {
			setUploads([]);
		} finally {
			setUploadsLoading(false);
		}
	}, []);

	useEffect(() => {
		refreshUploads();
	}, [refreshUploads]);

	const filteredSongs = useMemo(() => {
		if (category === "training" || category === "custom") return [];
		const term = search.trim().toLowerCase();
		return initialSongs.filter((song) => {
			if (song.category !== category) return false;
			if (!term) return true;
			const hay = [song.title, song.artist ?? "", song.subcategoryLabel ?? ""].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [initialSongs, category, search]);

	const filteredUploads = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return uploads;
		return uploads.filter((u) => {
			const hay = [u.title, u.artist].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [uploads, search]);

	useEffect(() => {
		if (category === "custom") {
			if (filteredUploads.length === 0) {
				setSelectedId(null);
				return;
			}
			if (!filteredUploads.find((u) => u.id === selectedId)) {
				setSelectedId(filteredUploads[0].id);
			}
			return;
		}
		if (filteredSongs.length === 0) {
			setSelectedId(null);
			return;
		}
		if (!filteredSongs.find((s) => s.id === selectedId)) {
			setSelectedId(filteredSongs[0].id);
		}
	}, [filteredSongs, filteredUploads, category, selectedId]);

	const handlePlayById = useCallback(
		(id: string) => {
			router.push(`/practice/play/${encodeURIComponent(id)}`);
		},
		[router],
	);

	const handlePlayBuiltIn = (song: BuiltInSong) => handlePlayById(song.id);

	const handleStart = () => {
		if (!selectedId) return;
		handlePlayById(selectedId);
	};

	const handleTabChange = (next: PracticeTab) => {
		setTab(next);
		if (next === "import") {
			setCategory("custom");
			setUploadModalOpen(true);
		}
	};

	const handleCategoryChange = (next: CategoryFilter) => {
		setCategory(next);
		setTab(next === "custom" ? "songs" : "songs");
	};

	const handleUploaded = useCallback(
		async (id: string) => {
			await refreshUploads();
			setCategory("custom");
			setSelectedId(id);
		},
		[refreshUploads],
	);

	const handleDeleteUpload = useCallback(
		async (id: string) => {
			await deleteUploadedSong(id);
			await refreshUploads();
		},
		[refreshUploads],
	);

	const isCustom = category === "custom";
	const isTraining = category === "training";

	const startDisabled = isCustom
		? !selectedId || filteredUploads.length === 0
		: isTraining
			? true
			: !selectedId || filteredSongs.length === 0;

	return (
		<div className="h-full w-full">
			<div className="mx-auto max-w-[1100px] h-full flex flex-col gap-10 px-12 pt-12 pb-12">
				<header className="flex items-start justify-between gap-6">
					<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
						Select your song
					</h1>
					<PracticeTabs active={tab} onChange={handleTabChange} />
				</header>

				<div className="grid grid-cols-[300px_1fr] gap-10 flex-1 min-h-0">
					<div className="flex flex-col items-start gap-7">
						<SearchBar value={search} onChange={setSearch} />
						<CategoryList active={category} onChange={handleCategoryChange} />
						<StartButton onClick={handleStart} disabled={startDisabled} />
					</div>

					<div className="min-h-0 overflow-hidden">
						{isTraining ? (
							<div className="flex h-full w-full items-center justify-center text-white/50 italic text-lg">
								Courses are coming soon.
							</div>
						) : isCustom ? (
							<UploadsView
								uploads={filteredUploads}
								loading={uploadsLoading}
								selectedId={selectedId}
								onSelect={setSelectedId}
								onPlay={handlePlayById}
								onDelete={handleDeleteUpload}
								onUploadClick={() => setUploadModalOpen(true)}
							/>
						) : (
							<SongList
								songs={filteredSongs}
								selectedId={selectedId}
								onSelect={(song) => setSelectedId(song.id)}
								onPlay={handlePlayBuiltIn}
							/>
						)}
					</div>
				</div>
			</div>

			<UploadModal
				open={uploadModalOpen}
				onClose={() => setUploadModalOpen(false)}
				onUploaded={handleUploaded}
			/>
		</div>
	);
}
