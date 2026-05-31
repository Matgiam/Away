"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { CategoryList, type CategoryFilter, type CategoryStats } from "./CategoryList";
import { SearchBar } from "./SearchBar";
import { SongList } from "./SongList";
import { StartButton } from "./StartButton";
import { PracticeTabs, type PracticeTab } from "./PracticeTabs";
import { UploadModal } from "./UploadModal";
import { UploadsView, type CustomRow } from "./UploadsView";
import { CommunityView } from "./CommunityView";
import { PublishToCommunityModal } from "./PublishToCommunityModal";
import type { BuiltInSong } from "@/lib/practice/songs";
import {
	deleteUploadedSong,
	listUploadedSongs,
	type UploadedSongMeta,
} from "@/lib/practice/uploads";
import {
	COMMUNITY_PAGE_SIZE,
	listApprovedCommunityMidis,
	listMyAddedCommunityMidis,
	listMyCommunitySubmissions,
	removeCommunityFromCustom,
	type CommunityMidi,
} from "@/lib/practice/community";
import {
	ACHIEVEMENT_UNLOCK_EVENT,
	getCompletedSongs,
} from "@/lib/achievements";
import { createClient } from "@/lib/supabase/client";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";

interface PracticeMenuProps {
	initialSongs: BuiltInSong[];
}

export function PracticeMenu({ initialSongs }: PracticeMenuProps) {
	const router = useAppRouter();
	const { unlockAudio } = useAudioEngineContext();

	useEffect(() => {
		router.prefetch("/practice/courses");
	}, [router]);

	const [tab, setTab] = useState<PracticeTab>("songs");
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CategoryFilter>("all");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const [uploads, setUploads] = useState<UploadedSongMeta[]>([]);
	const [mySubmissions, setMySubmissions] = useState<CommunityMidi[]>([]);
	const [addedCommunity, setAddedCommunity] = useState<CommunityMidi[]>([]);
	const [communityMidis, setCommunityMidis] = useState<CommunityMidi[]>([]);
	const [communityHasMore, setCommunityHasMore] = useState(false);
	const [communityLoadingMore, setCommunityLoadingMore] = useState(false);

	// Debounced version of `search` — community queries fire against the server,
	// so we don't want to spam Supabase on every keystroke.
	const [debouncedSearch, setDebouncedSearch] = useState("");

	const [uploadsLoading, setUploadsLoading] = useState(true);
	const [communityLoading, setCommunityLoading] = useState(true);

	// Race-protect overlapping fetches. Bumped on each first-page fetch; any
	// in-flight load-more that finishes after a refetch is discarded.
	const communityFetchTokenRef = useRef(0);

	const [uploadModalOpen, setUploadModalOpen] = useState(false);
	const [publishTarget, setPublishTarget] = useState<UploadedSongMeta | null>(null);

	const [userId, setUserId] = useState<string | null>(null);
	const [authChecked, setAuthChecked] = useState(false);
	const [completedSongIds, setCompletedSongIds] = useState<string[]>(() => getCompletedSongs());

	// Submissions are keyed by community submission id (raw row id); we look them up
	// by row id stored on the upload.
	const submissionByRowId = useMemo(() => {
		const map = new Map<string, CommunityMidi>();
		for (const sub of mySubmissions) {
			const rowId = sub.id.startsWith("c:") ? sub.id.slice(2) : sub.id;
			map.set(rowId, sub);
		}
		return map;
	}, [mySubmissions]);

	const refreshCustomRows = useCallback(async () => {
		setUploadsLoading(true);
		try {
			const [u, s, a] = await Promise.all([
				listUploadedSongs(),
				listMyCommunitySubmissions(),
				listMyAddedCommunityMidis(),
			]);
			setUploads(u);
			setMySubmissions(s);
			setAddedCommunity(a);
		} catch {
			setUploads([]);
			setMySubmissions([]);
			setAddedCommunity([]);
		} finally {
			setUploadsLoading(false);
		}
	}, []);

	const fetchCommunityFirstPage = useCallback(async (searchTerm: string) => {
		const token = ++communityFetchTokenRef.current;
		setCommunityLoading(true);
		try {
			const page = await listApprovedCommunityMidis({
				offset: 0,
				limit: COMMUNITY_PAGE_SIZE,
				search: searchTerm,
			});
			if (communityFetchTokenRef.current !== token) return;
			setCommunityMidis(page.items);
			setCommunityHasMore(page.hasMore);
		} catch {
			if (communityFetchTokenRef.current !== token) return;
			setCommunityMidis([]);
			setCommunityHasMore(false);
		} finally {
			if (communityFetchTokenRef.current === token) {
				setCommunityLoading(false);
			}
		}
	}, []);

	const loadMoreCommunity = useCallback(async () => {
		if (communityLoadingMore || !communityHasMore) return;
		setCommunityLoadingMore(true);
		const token = communityFetchTokenRef.current;
		try {
			const page = await listApprovedCommunityMidis({
				offset: communityMidis.length,
				limit: COMMUNITY_PAGE_SIZE,
				search: debouncedSearch,
			});
			// Drop result if the user refetched (e.g., changed search) while we
			// were in flight.
			if (communityFetchTokenRef.current !== token) return;
			setCommunityMidis((prev) => prev.concat(page.items));
			setCommunityHasMore(page.hasMore);
		} catch {
			// Swallow — the user can keep scrolling and the next loadMore retries.
		} finally {
			setCommunityLoadingMore(false);
		}
	}, [communityHasMore, communityLoadingMore, communityMidis.length, debouncedSearch]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const refresh = () => setCompletedSongIds(getCompletedSongs());
		window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, refresh);
		const onVisible = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, refresh);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, []);

	const completedSet = useMemo(() => new Set(completedSongIds), [completedSongIds]);

	useEffect(() => {
		const supabase = createClient();

		supabase.auth.getUser().then(({ data }) => {
			setUserId(data.user?.id ?? null);
			setAuthChecked(true);
			if (data.user) {
				refreshCustomRows();
				fetchCommunityFirstPage("");
			} else {
				setUploads([]);
				setMySubmissions([]);
				setAddedCommunity([]);
				setUploadsLoading(false);
				// Don't load the community catalog for signed-out users; the view will
				// prompt them to sign in.
				setCommunityLoading(false);
			}
		});

		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			const nextId = session?.user?.id ?? null;
			setUserId(nextId);
			if (nextId) {
				refreshCustomRows();
				fetchCommunityFirstPage("");
			} else {
				setUploads([]);
				setMySubmissions([]);
				setAddedCommunity([]);
				setCommunityMidis([]);
				setCommunityHasMore(false);
				setUploadsLoading(false);
				setCommunityLoading(false);
			}
		});

		return () => {
			sub.subscription.unsubscribe();
		};
	}, [refreshCustomRows, fetchCommunityFirstPage]);

	// Debounce the search box.
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
		return () => clearTimeout(timer);
	}, [search]);

	// Re-fetch the community first page when the search term settles. Skipped
	// while the user is on a non-community category, but we still refetch the
	// first time they switch back (the effect re-runs on category change too).
	useEffect(() => {
		if (!userId) return;
		if (category !== "community") return;
		fetchCommunityFirstPage(debouncedSearch);
	}, [userId, category, debouncedSearch, fetchCommunityFirstPage]);

	// Built-in songs filtered by category + search. "all" skips the category
	// filter so every built-in song is included regardless of its category.
	const filteredSongs = useMemo(() => {
		if (category === "custom" || category === "community") return [];
		const term = search.trim().toLowerCase();
		return initialSongs.filter((song) => {
			if (category !== "all" && song.category !== category) return false;
			if (!term) return true;
			const hay = [song.title, song.artist ?? "", song.subcategoryLabel ?? ""].join(" ").toLowerCase();
			return hay.includes(term);
		});
	}, [initialSongs, category, search]);

	// Custom rows = private uploads + community songs the user added
	const customRows = useMemo<CustomRow[]>(() => {
		const term = search.trim().toLowerCase();
		const rows: CustomRow[] = [];
		for (const upload of uploads) {
			const subRowId = upload.communitySubmissionId ?? null;
			const submission = subRowId ? submissionByRowId.get(subRowId) ?? null : null;
			rows.push({ kind: "upload", id: upload.id, upload, submission });
		}
		for (const community of addedCommunity) {
			rows.push({ kind: "community", id: community.id, community });
		}
		if (!term) return rows;
		return rows.filter((row) => {
			const hay =
				row.kind === "upload"
					? [row.upload.title, row.upload.artist]
					: [row.community.title, row.community.artist, row.community.submitterUsername ?? ""];
			return hay.join(" ").toLowerCase().includes(term);
		});
	}, [uploads, addedCommunity, submissionByRowId, search]);

	// Community filtering happens server-side via ilike on title/artist. We use
	// the loaded list as-is so pagination stays meaningful.
	const filteredCommunity = communityMidis;

	const addedCommunityIdSet = useMemo(
		() => new Set(addedCommunity.map((m) => m.id)),
		[addedCommunity],
	);

	const categoryStats = useMemo<Partial<Record<CategoryFilter, CategoryStats>>>(() => {
		const out: Partial<Record<CategoryFilter, CategoryStats>> = {};
		for (const song of initialSongs) {
			const key = song.category as CategoryFilter;
			const stats = out[key] ?? { completed: 0, total: 0 };
			stats.total += 1;
			if (completedSet.has(song.id)) stats.completed += 1;
			out[key] = stats;
		}
		// "All" mirrors filteredSongs scope: every built-in song across categories.
		// Custom and Community get their own tabs and are not folded in here.
		out["all"] = {
			total: initialSongs.length,
			completed: initialSongs.reduce((n, s) => n + (completedSet.has(s.id) ? 1 : 0), 0),
		};
		// Custom: user's own uploads + added community songs
		const customTotal = uploads.length + addedCommunity.length;
		const customCompleted =
			uploads.reduce((n, u) => n + (completedSet.has(u.id) ? 1 : 0), 0) +
			addedCommunity.reduce((n, c) => n + (completedSet.has(c.id) ? 1 : 0), 0);
		out["custom"] = { completed: customCompleted, total: customTotal };

		// Community is paginated — we don't know the true total so we deliberately
		// don't surface a counter (CategoryList hides the badge for missing entries).
		return out;
	}, [initialSongs, uploads, addedCommunity, completedSet]);

	const totalSongStats = useMemo<CategoryStats>(() => {
		const total = initialSongs.length + uploads.length + addedCommunity.length;
		const completedBuiltIn = initialSongs.reduce(
			(n, s) => n + (completedSet.has(s.id) ? 1 : 0),
			0,
		);
		const completedUploads = uploads.reduce((n, u) => n + (completedSet.has(u.id) ? 1 : 0), 0);
		const completedAdded = addedCommunity.reduce(
			(n, c) => n + (completedSet.has(c.id) ? 1 : 0),
			0,
		);
		return { completed: completedBuiltIn + completedUploads + completedAdded, total };
	}, [initialSongs, uploads, addedCommunity, completedSet]);

	// Keep the selected song valid as the visible list changes.
	useEffect(() => {
		if (category === "custom") {
			if (customRows.length === 0) {
				setSelectedId(null);
				return;
			}
			if (!customRows.find((r) => r.id === selectedId)) {
				setSelectedId(customRows[0].id);
			}
			return;
		}
		if (category === "community") {
			if (filteredCommunity.length === 0) {
				setSelectedId(null);
				return;
			}
			if (!filteredCommunity.find((c) => c.id === selectedId)) {
				setSelectedId(filteredCommunity[0].id);
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
	}, [filteredSongs, customRows, filteredCommunity, category, selectedId]);

	useEffect(() => {
		if (!selectedId) return;
		router.prefetch(`/practice/play/${encodeURIComponent(selectedId)}`);
	}, [router, selectedId]);

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
		if (next === "courses") {
			router.push("/practice/courses");
			return;
		}
		setTab(next);
		if (next === "import") {
			setCategory("custom");
			setUploadModalOpen(true);
		}
	};

	const handleCategoryChange = (next: CategoryFilter) => {
		// Category click is a real user gesture — use it to unlock the audio context
		// so that subsequent hover-previews on the Community page can produce sound.
		unlockAudio();
		setCategory(next);
		setTab("songs");
	};

	const handleUploaded = useCallback(
		async (id: string) => {
			await refreshCustomRows();
			setCategory("custom");
			setSelectedId(id);
		},
		[refreshCustomRows],
	);

	const handleDeleteUpload = useCallback(
		async (id: string) => {
			await deleteUploadedSong(id);
			await refreshCustomRows();
		},
		[refreshCustomRows],
	);

	const handleRemoveCommunity = useCallback(
		async (communityId: string) => {
			await removeCommunityFromCustom(communityId);
			await refreshCustomRows();
		},
		[refreshCustomRows],
	);

	const handleOpenPublish = useCallback((upload: UploadedSongMeta) => {
		setPublishTarget(upload);
	}, []);

	const handlePublished = useCallback(async () => {
		await refreshCustomRows();
	}, [refreshCustomRows]);

	const isCustom = category === "custom";
	const isCommunity = category === "community";
	const signedIn = !!userId;

	const startDisabled = isCustom
		? !signedIn || !selectedId || customRows.length === 0
		: isCommunity
			? !signedIn || !selectedId || filteredCommunity.length === 0
			: !selectedId || filteredSongs.length === 0;

	return (
		<div className="h-full w-full">
			<div className="mx-auto max-w-[1200px] h-full flex flex-col gap-12 px-1 pt-12 pb-12">
				<header className="flex items-start justify-between gap-12">
					<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
						Select your song
					</h1>
					<PracticeTabs active={tab} onChange={handleTabChange} />
				</header>

				<div className="grid grid-cols-[300px_1fr] gap-30 flex-1 min-h-0">
					<div className="flex flex-col items-start gap-7">
						<SearchBar value={search} onChange={setSearch} />
						<CategoryList
							active={category}
							onChange={handleCategoryChange}
							stats={categoryStats}
							totalStats={totalSongStats}
						/>
						<StartButton onClick={handleStart} disabled={startDisabled} />
					</div>

					<div className="min-h-0 overflow-hidden">
						{isCustom ? (
							<UploadsView
								rows={customRows}
								loading={!authChecked || uploadsLoading}
								signedIn={signedIn}
								selectedId={selectedId}
								completedIds={completedSet}
								onSelect={setSelectedId}
								onPlay={handlePlayById}
								onDelete={handleDeleteUpload}
								onUploadClick={() => setUploadModalOpen(true)}
								onPublish={handleOpenPublish}
								onRemoveCommunity={handleRemoveCommunity}
							/>
						) : isCommunity ? (
							<CommunityView
								midis={filteredCommunity}
								loading={!authChecked || communityLoading}
								signedIn={signedIn}
								selectedId={selectedId}
								addedIds={addedCommunityIdSet}
								hasMore={communityHasMore}
								loadingMore={communityLoadingMore}
								onSelect={setSelectedId}
								onPlay={handlePlayById}
								onAddedChanged={refreshCustomRows}
								onLoadMore={loadMoreCommunity}
							/>
						) : (
							<SongList
								songs={filteredSongs}
								selectedId={selectedId}
								completedIds={completedSet}
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
				signedIn={signedIn}
			/>

			<PublishToCommunityModal
				open={!!publishTarget}
				upload={publishTarget}
				onClose={() => setPublishTarget(null)}
				onSubmitted={handlePublished}
			/>
		</div>
	);
}
