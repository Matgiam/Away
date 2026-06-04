"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { PreviewButton, type PreviewButtonState } from "@/components/practice/PreviewButton";
import {
	CategoryFilterPills,
	type SubCategoryFilter,
} from "@/components/practice/CategoryFilterPills";
import { CategoryEditorBadge } from "@/components/practice/CategoryEditorBadge";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useMidiPreview } from "@/hooks/useMidiPreview";
import { useVirtualList } from "@/hooks/useVirtualList";
import {
	downloadCommunityMidi,
	getCommunityMidiPublicUrl,
	type CommunityMidi,
	type CommunityStatus,
} from "@/lib/practice/community";
import {
	downloadUploadedMidi,
	getUploadedSongSignedUrl,
	type UploadDifficulty,
	type UploadedSongMeta,
} from "@/lib/practice/uploads";
import type { SongCategoryKey } from "@/lib/practice/songs";

const PREVIEW_SECONDS = 50;

// A row in the Custom category can come from the user's own private uploads OR
// from a community MIDI they added via "Add to Custom". The wrapper type lets
// the rest of the component stay agnostic.
export type CustomRow =
	| {
			kind: "upload";
			id: string;
			upload: UploadedSongMeta;
			submission: CommunityMidi | null;
	  }
	| {
			kind: "community";
			id: string;
			community: CommunityMidi;
	  };

interface UploadsViewProps {
	rows: CustomRow[];
	loading: boolean;
	signedIn: boolean;
	selectedId: string | null;
	completedIds?: ReadonlySet<string>;
	onSelect: (id: string) => void;
	onPlay: (id: string) => void;
	onDelete: (id: string) => void;
	onUploadClick: () => void;
	onPublish: (upload: UploadedSongMeta) => void;
	onRemoveCommunity: (communityId: string) => void;
	// Sub-category filter state lives in the parent so it can be persisted
	// alongside the main `category` selection.
	activeCategory: SubCategoryFilter;
	onActiveCategoryChange: (next: SubCategoryFilter) => void;
	// Called when the owner changes a row's category via the inline badge.
	// The parent both persists it to the DB and updates its local row state.
	onUploadCategoryChange: (uploadId: string, category: SongCategoryKey | null) => void;
}

const ROW_HEIGHT = 76;
const ROW_GAP = 12;
const UPLOAD_BUTTON_HEIGHT = 64;

function CompletedTick() {
	return (
		<span
			className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-emerald-300/40 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_rgba(120,220,160,0.18)] shrink-0"
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

export function UploadsView({
	rows,
	loading,
	signedIn,
	selectedId,
	completedIds,
	onSelect,
	onPlay,
	onDelete,
	onUploadClick,
	onPublish,
	onRemoveCommunity,
	activeCategory,
	onActiveCategoryChange,
	onUploadCategoryChange,
}: UploadsViewProps) {
	const preview = useMidiPreview();
	const { unlockAudio } = useAudioEngineContext();
	const [previewingId, setPreviewingId] = useState<string | null>(null);
	const [exportingId, setExportingId] = useState<string | null>(null);

	// Stop any in-flight preview if the user navigates away from this tab.
	useEffect(() => {
		return () => {
			preview.stop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (preview.state === "idle") setPreviewingId(null);
	}, [preview.state]);

	const togglePreview = useCallback(
		async (row: CustomRow) => {
			// The click is a user gesture — unlock here so the audio context resumes
			// on the first try regardless of which row triggers playback first.
			unlockAudio();
			if (previewingId === row.id) {
				preview.stop();
				setPreviewingId(null);
				return;
			}
			setPreviewingId(row.id);
			try {
				const url =
					row.kind === "community"
						? getCommunityMidiPublicUrl(row.community.storagePath)
						: await getUploadedSongSignedUrl(row.upload.storagePath);
				// If the user clicked something else while we were minting the URL,
				// don't kick off a preview for the original row.
				if (previewingId !== row.id && previewingId !== null) return;
				preview.play(url, { maxDurationSec: PREVIEW_SECONDS });
			} catch (err) {
				console.error("Preview failed", err);
				setPreviewingId(null);
			}
		},
		[preview, previewingId, unlockAudio],
	);

	const handleExport = useCallback(async (row: CustomRow) => {
		setExportingId(row.id);
		try {
			const bytes =
				row.kind === "community"
					? await downloadCommunityMidi(row.community.storagePath)
					: await downloadUploadedMidi(row.upload.storagePath);
			const blob = new Blob([bytes], { type: "audio/midi" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = exportFileName(row);
			document.body.appendChild(a);
			a.click();
			a.remove();
			// Let the click dispatch finish before reclaiming the blob URL — Firefox
			// occasionally cancels the download if you revoke synchronously.
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err) {
			console.error("MIDI export failed", err);
			alert("Couldn't export this MIDI. Check your connection and try again.");
		} finally {
			setExportingId((current) => (current === row.id ? null : current));
		}
	}, []);

	// One source of truth for "which category does this row belong to". Both
	// upload-kind (owner-set) and community-kind (publisher-set) carry a
	// `category` field; null means "Uncategorized".
	const categoryOf = useCallback(
		(row: CustomRow): SongCategoryKey | null =>
			row.kind === "upload" ? row.upload.category : row.community.category,
		[],
	);

	// Filter pass — runs whenever rows or the active filter changes. The
	// resulting list drives the virtualizer below, so changing filter snaps
	// the scrollbar to the new content range.
	const filteredRows = useMemo(() => {
		if (activeCategory === null) return rows;
		if (activeCategory === "uncategorized") return rows.filter((r) => categoryOf(r) === null);
		return rows.filter((r) => categoryOf(r) === activeCategory);
	}, [rows, activeCategory, categoryOf]);

	// Counts per filter bucket — shown as small badges in the pill row so the
	// user can see how many rows live in each before clicking.
	const categoryCounts = useMemo(() => {
		const out: Partial<Record<string, number>> = { all: rows.length, uncategorized: 0 };
		for (const r of rows) {
			const c = categoryOf(r);
			if (c === null) out.uncategorized = (out.uncategorized ?? 0) + 1;
			else out[c] = (out[c] ?? 0) + 1;
		}
		return out;
	}, [rows, categoryOf]);

	const { containerRef, onScroll, totalHeight, startIndex, endIndex, offsetForIndex } =
		useVirtualList({
			itemCount: filteredRows.length,
			itemHeight: ROW_HEIGHT,
			gap: ROW_GAP,
			overscan: 4,
		});

	const visibleIndices = useMemo(() => {
		const out: number[] = [];
		for (let i = startIndex; i < endIndex; i++) out.push(i);
		return out;
	}, [startIndex, endIndex]);

	if (!signedIn) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="flex flex-col items-center text-center px-10 py-12 rounded-2xl border-2 border-dashed border-white/15 max-w-[500px]">
					<svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="text-white/55 mb-4">
						<rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
						<path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
					</svg>
					<p className="text-white text-lg italic font-semibold mb-1">Sign in to see your uploads</p>
					<p className="text-white/55 text-sm">
						Your imported MIDI files are saved to your account so only you can see them.
					</p>
					<a
						href="/auth/login"
						className="mt-6 px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform"
					>
						Sign in
					</a>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex h-full w-full items-center justify-center text-white/50 italic">
				Loading your uploads…
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<button
					type="button"
					onClick={onUploadClick}
					className="group flex flex-col items-center text-center px-10 py-12 rounded-2xl border-2 border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors max-w-[500px]"
				>
					<svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="text-white/55 group-hover:text-white/80 mb-4 transition-colors">
						<path
							d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<p className="text-white text-lg italic font-semibold mb-1">
						Upload your first MIDI
					</p>
					<p className="text-white/50 text-sm">
						.mid or .midi files · max 10 MB
					</p>
				</button>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			onScroll={onScroll}
			className="practice-song-list h-full w-full overflow-y-auto overflow-x-hidden pr-4"
		>
			{/* Sub-category filter row — keeps Custom internally categorized so the
			    list stays browsable even with dozens of uploads. */}
			<div className="mb-4">
				<CategoryFilterPills
					active={activeCategory}
					onChange={onActiveCategoryChange}
					counts={categoryCounts}
				/>
			</div>

			<button
				type="button"
				onClick={onUploadClick}
				className="block transition-transform hover:scale-[1.005] mb-3"
				style={{ height: UPLOAD_BUTTON_HEIGHT }}
			>
				<DynamicLiquidGlass
					width={680}
					height={UPLOAD_BUTTON_HEIGHT}
					radius={14}
					refractionLevel={0.7}
					specularOpacity={0.55}
					glassBgOpacity={0.04}
				>
					<div className="flex h-full w-full items-center justify-center gap-2 text-white/85 italic">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
							<path
								d="M12 5v14M5 12h14"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
						</svg>
						<span className="text-base font-medium tracking-wide">Upload a new MIDI</span>
					</div>
				</DynamicLiquidGlass>
			</button>

			<div style={{ position: "relative", height: totalHeight }}>
				{visibleIndices.map((absoluteIndex) => {
					const row = filteredRows[absoluteIndex];
					if (!row) return null;
					const top = offsetForIndex(absoluteIndex);
					const isSelected = row.id === selectedId;
					const isCompleted = !!completedIds?.has(row.id);
					const isThisPreviewing = previewingId === row.id;
					const previewState: PreviewButtonState =
						isThisPreviewing && preview.state === "loading"
							? "loading"
							: isThisPreviewing && preview.state === "playing"
								? "playing"
								: "idle";
					const isExporting = exportingId === row.id;
					return (
						<div
							key={row.id}
							style={{
								position: "absolute",
								top,
								left: 0,
								right: 0,
								height: ROW_HEIGHT,
							}}
							className="transition-transform hover:scale-[1.005]"
						>
							<DynamicLiquidGlass
								width={680}
								height={ROW_HEIGHT}
								radius={14}
								refractionLevel={0.7}
								specularOpacity={0.55}
								glassBgOpacity={isSelected ? 0.12 : isThisPreviewing ? 0.07 : 0.02}
							>
								<div
									onClick={() => onSelect(row.id)}
									onDoubleClick={() => onPlay(row.id)}
									className="flex h-full w-full items-center justify-between px-7 cursor-pointer"
								>
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<PreviewButton
											state={previewState}
											onClick={(e) => {
												e.stopPropagation();
												void togglePreview(row);
											}}
										/>
										<div className="flex-1 min-w-0 flex flex-col">
											<div
												className={`text-lg italic font-semibold tracking-wide truncate text-left ${
													isSelected ? "text-white" : "text-white/80"
												}`}
											>
												{formatTitle(row)}
											</div>
											{row.kind === "community" && (
												<div className="text-[11px] italic text-white/40 truncate text-left">
													From community · added from {row.community.submitterUsername ?? "another player"}
												</div>
											)}
											{row.kind === "upload" && row.submission && (
												<SubmissionStatusLine submission={row.submission} />
											)}
										</div>
									</div>
									<div className="flex items-center gap-3 shrink-0 ml-4">
										{isCompleted && <CompletedTick />}
										{/* Upload-kind rows let the owner edit the category inline.
										    Community-kind rows show the publisher's category as a
										    read-only chip so the user can still see where it lives. */}
										{row.kind === "upload" ? (
											<CategoryEditorBadge
												value={row.upload.category}
												onChange={(next) => onUploadCategoryChange(row.upload.id, next)}
											/>
										) : (
											<CategoryEditorBadge value={row.community.category} readOnly />
										)}
										<DifficultyBadge difficulty={difficultyOf(row)} />

										{row.kind === "upload" && (!row.submission || row.submission.status === "rejected") && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onPublish(row.upload);
												}}
												className="text-xs italic uppercase tracking-widest px-2.5 py-1 rounded-full border border-violet-300/30 bg-violet-500/15 text-violet-200/90 hover:bg-violet-500/25 transition-colors"
												title="Submit this MIDI for community review"
											>
												Publish
											</button>
										)}

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												void handleExport(row);
											}}
											disabled={isExporting}
											className="text-white/40 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-wait"
											aria-label="Export MIDI"
											title="Export MIDI"
										>
											{isExporting ? (
												<svg
													width="18"
													height="18"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="1.8"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="animate-spin"
												>
													<path d="M21 12a9 9 0 1 1-6.219-8.56" />
												</svg>
											) : (
												<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
													<path
														d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16"
														stroke="currentColor"
														strokeWidth="1.6"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											)}
										</button>

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												if (row.kind === "upload") {
													if (confirm(`Delete "${row.upload.title}"?`)) onDelete(row.id);
												} else {
													if (confirm(`Remove "${row.community.title}" from your custom songs?`))
														onRemoveCommunity(row.community.id);
												}
											}}
											className="text-white/40 hover:text-rose-300 transition-colors"
											aria-label={row.kind === "community" ? "Remove from custom" : "Delete"}
											title={row.kind === "community" ? "Remove from custom" : "Delete"}
										>
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
												<path
													d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</button>
									</div>
								</div>
							</DynamicLiquidGlass>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function formatTitle(row: CustomRow): string {
	if (row.kind === "upload") {
		return row.upload.artist ? `${row.upload.title} - ${row.upload.artist}` : row.upload.title;
	}
	return row.community.artist
		? `${row.community.title} - ${row.community.artist}`
		: row.community.title;
}

function exportFileName(row: CustomRow): string {
	// Build a safe-ish filename from the song's display title. Falls back to
	// the upload's original file name if the title sanitises to nothing.
	const base = formatTitle(row);
	const safe = base
		.replace(/[\\/:*?"<>|]+/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const stem = safe || (row.kind === "upload" ? row.upload.fileName.replace(/\.midi?$/i, "") : "song");
	return `${stem}.mid`;
}

function difficultyOf(row: CustomRow): UploadDifficulty {
	return row.kind === "upload" ? row.upload.difficulty : row.community.difficulty;
}

const STATUS_LABEL: Record<CommunityStatus, string> = {
	pending: "Pending review",
	approved: "Published",
	rejected: "Rejected",
};

const STATUS_COLOR: Record<CommunityStatus, string> = {
	pending: "text-amber-200/85",
	approved: "text-emerald-300/85",
	rejected: "text-rose-300/85",
};

function SubmissionStatusLine({ submission }: { submission: CommunityMidi }) {
	const isRejected = submission.status === "rejected";
	return (
		<div className="text-[11px] italic truncate text-left">
			<span className={STATUS_COLOR[submission.status]}>
				{STATUS_LABEL[submission.status]}
			</span>
			{isRejected && submission.reviewNote && (
				<span className="text-white/40"> · {submission.reviewNote}</span>
			)}
		</div>
	);
}

const DIFFICULTY_COLORS: Record<UploadDifficulty, string> = {
	easy: "bg-emerald-500/15 text-emerald-200/90 border-emerald-300/20",
	medium: "bg-amber-500/15 text-amber-200/90 border-amber-300/20",
	hard: "bg-rose-500/15 text-rose-200/90 border-rose-300/20",
};

function DifficultyBadge({ difficulty }: { difficulty: UploadDifficulty }) {
	return (
		<span
			className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${DIFFICULTY_COLORS[difficulty]}`}
		>
			{difficulty}
		</span>
	);
}
