"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { CategoryList, type CategoryFilter, type CategoryStats } from "./CategoryList";
import { SearchBar } from "./SearchBar";
import { SongList } from "./SongList";
import { StartButton } from "./StartButton";
import { PracticeTabs, type PracticeTab } from "./PracticeTabs";
import { UploadModal, type PrefilledMidi } from "./UploadModal";
import { UploadsView, type CustomRow } from "./UploadsView";
import { CommunityView } from "./CommunityView";
import { PublishToCommunityModal } from "./PublishToCommunityModal";
import { useTranscriptionContext } from "@/components/providers/TranscriptionProvider";
import type { BuiltInSong, SongCategoryKey } from "@/lib/practice/songs";
import type { SubCategoryFilter } from "@/components/practice/CategoryFilterPills";
import {
	deleteUploadedSong,
	listUploadedSongs,
	updateUploadedSongMeta,
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

const PRACTICE_CATEGORY_KEY = "away:practice-category";
const PRACTICE_SELECTED_KEY = "away:practice-selected-id";

// Guard against stale or invalid values being restored from localStorage.
// Anything outside this set falls back to the default ("all").
const PERSISTABLE_CATEGORIES: ReadonlySet<string> = new Set<CategoryFilter>([
	"all",
	"video_games",
	"anime",
	"popular",
	"classical",
	"films",
	"tv_shows",
	"custom",
	"community",
]);

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

	// Two-phase localStorage restore for category + selectedId so we land back
	// on whatever the user was on last time. The hydrated flag is needed
	// because (a) initialising state from localStorage in useState would cause
	// an SSR/client mismatch, and (b) the existing "keep selection valid"
	// effect below would otherwise pre-empt our restore by snapping selectedId
	// to filteredSongs[0].id on initial mount.
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const savedCat = window.localStorage.getItem(PRACTICE_CATEGORY_KEY);
			const savedId = window.localStorage.getItem(PRACTICE_SELECTED_KEY);
			if (savedCat && PERSISTABLE_CATEGORIES.has(savedCat)) {
				setCategory(savedCat as CategoryFilter);
			}
			if (savedId) setSelectedId(savedId);
		} catch {
			// localStorage can throw in private mode / quota issues — ignore.
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated || typeof window === "undefined") return;
		try {
			window.localStorage.setItem(PRACTICE_CATEGORY_KEY, category);
		} catch {}
	}, [hydrated, category]);

	useEffect(() => {
		if (!hydrated || typeof window === "undefined") return;
		try {
			if (selectedId) window.localStorage.setItem(PRACTICE_SELECTED_KEY, selectedId);
			else window.localStorage.removeItem(PRACTICE_SELECTED_KEY);
		} catch {}
	}, [hydrated, selectedId]);

	const [uploads, setUploads] = useState<UploadedSongMeta[]>([]);
	const [mySubmissions, setMySubmissions] = useState<CommunityMidi[]>([]);
	const [addedCommunity, setAddedCommunity] = useState<CommunityMidi[]>([]);
	const [communityMidis, setCommunityMidis] = useState<CommunityMidi[]>([]);
	const [communityHasMore, setCommunityHasMore] = useState(false);
	const [communityLoadingMore, setCommunityLoadingMore] = useState(false);

	// Sub-category filters for Custom and Community. null = "All".
	// Custom is client-side (small list per user); Community is server-side
	// (refetches when this changes, see fetchCommunityFirstPage call below).
	const [customCategory, setCustomCategory] = useState<SubCategoryFilter>(null);
	const [communityCategory, setCommunityCategory] = useState<SubCategoryFilter>(null);

	// Debounced version of `search` — community queries fire against the server,
	// so we don't want to spam Supabase on every keystroke.
	const [debouncedSearch, setDebouncedSearch] = useState("");

	const [uploadsLoading, setUploadsLoading] = useState(true);
	const [communityLoading, setCommunityLoading] = useState(true);

	// Race-protect overlapping fetches. Bumped on each first-page fetch; any
	// in-flight load-more that finishes after a refetch is discarded.
	const communityFetchTokenRef = useRef(0);

	const [uploadModalOpen, setUploadModalOpen] = useState(false);
	// When the toast is clicked after a transcription finishes, we open the
	// upload modal with this set so it lands straight on the form stage.
	// Cleared when the modal closes so a new transcription doesn't accidentally
	// reopen it with stale data.
	const [prefilledMidi, setPrefilledMidi] = useState<PrefilledMidi | null>(null);
	const [publishTarget, setPublishTarget] = useState<UploadedSongMeta | null>(null);

	const transcription = useTranscriptionContext();

	// When the toast is clicked from elsewhere in the app (or right here), the
	// provider flips pendingFinalize on. We pick it up, open the modal with the
	// completed MIDI prefilled, and consume the flag so the effect doesn't fire
	// again next render.
	useEffect(() => {
		if (!transcription.pendingFinalize) return;
		if (transcription.state.phase !== "done") {
			// State changed under us (cancel/dismiss); just clear the flag.
			transcription.consumePendingFinalize();
			return;
		}
		setPrefilledMidi({
			file: transcription.state.midiFile,
			fileName: transcription.state.midiFile.name,
			buffer: transcription.state.midiBuffer,
			audioFile: transcription.state.audioFile,
		});
		setUploadModalOpen(true);
		transcription.consumePendingFinalize();
	}, [transcription]);

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

	// Translate the UI filter into the server query param. null on the UI side
	// means "All" (no filter), so we send undefined to the API.
	const categoryParam = useCallback(
		(filter: SubCategoryFilter): SongCategoryKey | "uncategorized" | undefined => {
			if (filter === null) return undefined;
			return filter;
		},
		[],
	);

	const fetchCommunityFirstPage = useCallback(
		async (searchTerm: string, filter: SubCategoryFilter) => {
			const token = ++communityFetchTokenRef.current;
			setCommunityLoading(true);
			try {
				const page = await listApprovedCommunityMidis({
					offset: 0,
					limit: COMMUNITY_PAGE_SIZE,
					search: searchTerm,
					category: categoryParam(filter),
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
		},
		[categoryParam],
	);

	const loadMoreCommunity = useCallback(async () => {
		if (communityLoadingMore || !communityHasMore) return;
		setCommunityLoadingMore(true);
		const token = communityFetchTokenRef.current;
		try {
			const page = await listApprovedCommunityMidis({
				offset: communityMidis.length,
				limit: COMMUNITY_PAGE_SIZE,
				search: debouncedSearch,
				category: categoryParam(communityCategory),
			});
			// Drop result if the user refetched (e.g., changed search or category)
			// while we were in flight.
			if (communityFetchTokenRef.current !== token) return;
			setCommunityMidis((prev) => prev.concat(page.items));
			setCommunityHasMore(page.hasMore);
		} catch {
			// Swallow — the user can keep scrolling and the next loadMore retries.
		} finally {
			setCommunityLoadingMore(false);
		}
	}, [communityHasMore, communityLoadingMore, communityMidis.length, debouncedSearch, communityCategory, categoryParam]);

	// Owner changes a row's category from the inline badge. Optimistic update
	// of the local list so the filter pills react instantly; on DB failure we
	// roll back to the previous value so the chip reflects what's actually in
	// the database. Supabase errors don't serialize through default
	// console.error output ({} appears in the console), so we unpack the
	// useful fields explicitly.
	const handleChangeUploadCategory = useCallback(
		async (uploadId: string, category: SongCategoryKey | null) => {
			let previousCategory: SongCategoryKey | null = null;
			setUploads((prev) =>
				prev.map((u) => {
					if (u.id !== uploadId) return u;
					previousCategory = u.category;
					return { ...u, category };
				}),
			);
			try {
				await updateUploadedSongMeta(uploadId, { category });
			} catch (err) {
				// Roll back the optimistic update so the badge matches the DB state.
				setUploads((prev) =>
					prev.map((u) => (u.id === uploadId ? { ...u, category: previousCategory } : u)),
				);
				// Supabase PostgrestError carries { message, code, details, hint }
				// but none of those are own-enumerable, so JSON.stringify renders
				// "{}". Pluck them by hand for an actually readable log line.
				const e = err as { message?: string; code?: string; details?: string; hint?: string } | undefined;
				console.error(
					"Failed to update upload category:",
					e?.message ?? String(err),
					e?.code ? `[code ${e.code}]` : "",
					e?.details ?? "",
					e?.hint ?? "",
				);
				if (e?.code === "42703" || /column .* does not exist/i.test(e?.message ?? "")) {
					// Most likely cause: the user hasn't run the
					// `add_song_categories.sql` migration in their Supabase
					// project. Surface it loudly so they know what to fix.
					alert(
						"The `category` column is missing on user_song_uploads. " +
							"Run away/scripts/sql/add_song_categories.sql in your Supabase SQL editor to add it.",
					);
				}
			}
		},
		[],
	);

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
				fetchCommunityFirstPage("", null);
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
				fetchCommunityFirstPage("", null);
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

	// Re-fetch the community first page when the search term OR sub-category
	// filter settles. Skipped while the user is on a non-community category,
	// but the effect re-runs on category change too so switching back picks
	// up the latest filter.
	useEffect(() => {
		if (!userId) return;
		if (category !== "community") return;
		fetchCommunityFirstPage(debouncedSearch, communityCategory);
	}, [userId, category, debouncedSearch, communityCategory, fetchCommunityFirstPage]);

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

	// Keep the selected song valid as the visible list changes. Skipped until
	// localStorage restore has completed so we don't snap to "first item" and
	// override the user's last selection on mount.
	useEffect(() => {
		if (!hydrated) return;
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
	}, [hydrated, filteredSongs, customRows, filteredCommunity, category, selectedId]);

	useEffect(() => {
		if (!selectedId) return;
		router.prefetch(`/practice/play/${encodeURIComponent(selectedId)}`);
	}, [router, selectedId]);

	const handlePlayById = useCallback(
		(id: string) => {
			unlockAudio();
			router.push(`/practice/play/${encodeURIComponent(id)}`);
		},
		[router, unlockAudio],
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
			{/* Authored at the 1920×1080 reference; the global app stage scales the
		    whole page uniformly to fit any screen (see lib/appScale.ts). */}
		<div
			className="mx-auto h-full flex flex-col"
			style={{
				maxWidth: "1200px",
				gap: "48px",
				paddingLeft: "2px",
				paddingRight: "2px",
				paddingTop: "48px",
				paddingBottom: "48px",
			}}
		>
				<header className="flex items-start justify-between gap-12">
					<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
						Select your song
					</h1>
					<PracticeTabs active={tab} onChange={handleTabChange} />
				</header>

				<div
					className="grid flex-1 min-h-0"
					style={{
						gridTemplateColumns: "300px 1fr",
						columnGap: "96px",
					}}
				>
					<div className="flex flex-col items-start gap-7">
						<SearchBar value={search} onChange={setSearch} />
						<CategoryList
							active={category}
							onChange={handleCategoryChange}
							stats={categoryStats}
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
								activeCategory={customCategory}
								onActiveCategoryChange={setCustomCategory}
								onUploadCategoryChange={handleChangeUploadCategory}
							/>
						) : isCommunity ? (
							<CommunityView
								midis={filteredCommunity}
								loading={!authChecked || communityLoading}
								signedIn={signedIn}
								selectedId={selectedId}
								addedIds={addedCommunityIdSet}
								currentUserId={userId}
								hasMore={communityHasMore}
								loadingMore={communityLoadingMore}
								onSelect={setSelectedId}
								onPlay={handlePlayById}
								onAddedChanged={refreshCustomRows}
								onLoadMore={loadMoreCommunity}
								activeCategory={communityCategory}
								onActiveCategoryChange={setCommunityCategory}
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
				onClose={() => {
					setUploadModalOpen(false);
					// Clear the prefill so the next open without a fresh transcription
					// shows the drop stage again.
					setPrefilledMidi(null);
					// If we just closed the form view of a completed transcription,
					// the toast still says "Ready" — clear it so it doesn't reappear
					// after the modal is dismissed without saving.
					if (transcription.state.phase === "done") {
						transcription.dismiss();
					}
				}}
				onUploaded={(id) => {
					handleUploaded(id);
					setPrefilledMidi(null);
					// On successful save, drop the completed transcription so the
					// toast doesn't linger.
					if (transcription.state.phase === "done") {
						transcription.dismiss();
					}
				}}
				signedIn={signedIn}
				onStartTranscription={(file, engine) => transcription.start(file, engine)}
				prefilledMidi={prefilledMidi}
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
