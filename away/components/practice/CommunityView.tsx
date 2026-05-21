"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useMidiPreview } from "@/hooks/useMidiPreview";
import { useVirtualList } from "@/hooks/useVirtualList";
import {
	addCommunityToCustom,
	getCommunityMidiPublicUrl,
	incrementCommunityPlayCount,
	removeCommunityFromCustom,
	type CommunityMidi,
} from "@/lib/practice/community";
import type { UploadDifficulty } from "@/lib/practice/uploads";

interface CommunityViewProps {
	midis: CommunityMidi[];
	loading: boolean;
	signedIn: boolean;
	selectedId: string | null;
	addedIds: ReadonlySet<string>;
	hasMore: boolean;
	loadingMore: boolean;
	onSelect: (id: string) => void;
	onPlay: (id: string) => void;
	onAddedChanged: () => void;
	onLoadMore: () => void;
}

const HOVER_DELAY_MS = 250;
const PREVIEW_SECONDS = 50;
const ROW_HEIGHT = 84;
const ROW_GAP = 12;

export function CommunityView({
	midis,
	loading,
	signedIn,
	selectedId,
	addedIds,
	hasMore,
	loadingMore,
	onSelect,
	onPlay,
	onAddedChanged,
	onLoadMore,
}: CommunityViewProps) {
	const preview = useMidiPreview();
	const { unlockAudio } = useAudioEngineContext();
	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	const startHoverPreview = useCallback(
		(midi: CommunityMidi) => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
			setHoveredId(midi.id);
			hoverTimerRef.current = setTimeout(() => {
				const url = getCommunityMidiPublicUrl(midi.storagePath);
				preview.play(url, { maxDurationSec: PREVIEW_SECONDS });
			}, HOVER_DELAY_MS);
		},
		[preview],
	);

	const stopHoverPreview = useCallback(() => {
		if (hoverTimerRef.current) {
			clearTimeout(hoverTimerRef.current);
			hoverTimerRef.current = null;
		}
		setHoveredId(null);
		preview.stop();
	}, [preview]);

	useEffect(() => {
		return () => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
			preview.stop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAddToCustom = useCallback(
		async (midi: CommunityMidi) => {
			setBusyId(midi.id);
			try {
				if (addedIds.has(midi.id)) await removeCommunityFromCustom(midi.id);
				else await addCommunityToCustom(midi.id);
				onAddedChanged();
			} finally {
				setBusyId(null);
			}
		},
		[addedIds, onAddedChanged],
	);

	const handlePlay = useCallback(
		(id: string) => {
			incrementCommunityPlayCount(id).catch(() => {});
			onPlay(id);
		},
		[onPlay],
	);

	// Reserve one extra "row" at the bottom for the loading-more indicator so the
	// scroll-end trigger fires before the user runs out of content.
	const virtualCount = midis.length + (hasMore ? 1 : 0);

	const handleEndReached = useCallback(() => {
		if (hasMore && !loadingMore) onLoadMore();
	}, [hasMore, loadingMore, onLoadMore]);

	const { containerRef, onScroll, totalHeight, startIndex, endIndex, offsetForIndex } =
		useVirtualList({
			itemCount: virtualCount,
			itemHeight: ROW_HEIGHT,
			gap: ROW_GAP,
			overscan: 4,
			onEndReached: handleEndReached,
		});

	const visibleIndices = useMemo(() => {
		const out: number[] = [];
		for (let i = startIndex; i < endIndex; i++) out.push(i);
		return out;
	}, [startIndex, endIndex]);

	if (!signedIn) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="flex flex-col items-center text-center px-10 py-12 rounded-2xl border-2 border-dashed border-white/15 max-w-[520px]">
					<p className="text-white text-lg italic font-semibold mb-1">
						Sign in to browse the community library
					</p>
					<p className="text-white/55 text-sm">
						The community library is a curated collection of MIDI files published by other players.
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

	if (loading && midis.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center text-white/50 italic">
				Loading community library…
			</div>
		);
	}

	if (midis.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="flex flex-col items-center text-center px-10 py-12 rounded-2xl border-2 border-dashed border-white/15 max-w-[520px]">
					<p className="text-white text-lg italic font-semibold mb-1">No community MIDIs yet</p>
					<p className="text-white/55 text-sm">
						Be the first to publish! Upload a MIDI under Custom, then hit{" "}
						<span className="text-white/85">Publish</span> on it.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			onScroll={onScroll}
			className="practice-song-list h-full w-full overflow-y-auto pr-4"
		>
			<div style={{ position: "relative", height: totalHeight }}>
				{visibleIndices.map((absoluteIndex) => {
					const top = offsetForIndex(absoluteIndex);

					// Trailing sentinel row: "loading more…" placeholder.
					if (absoluteIndex >= midis.length) {
						return (
							<div
								key="load-more-sentinel"
								style={{
									position: "absolute",
									top,
									left: 0,
									right: 0,
									height: ROW_HEIGHT,
								}}
								className="flex items-center justify-center text-white/45 italic text-sm"
							>
								{loadingMore ? "Loading more…" : "Scroll for more"}
							</div>
						);
					}

					const midi = midis[absoluteIndex];
					const isSelected = midi.id === selectedId;
					const isAdded = addedIds.has(midi.id);
					const isHoverPreviewing = hoveredId === midi.id && preview.state !== "idle";
					return (
						<div
							key={midi.id}
							style={{
								position: "absolute",
								top,
								left: 0,
								right: 0,
								height: ROW_HEIGHT,
							}}
							className="transition-transform hover:scale-[1.005]"
							onMouseEnter={() => startHoverPreview(midi)}
							onMouseLeave={stopHoverPreview}
						>
							<DynamicLiquidGlass
								width={680}
								height={ROW_HEIGHT}
								radius={14}
								refractionLevel={0.7}
								specularOpacity={0.55}
								glassBgOpacity={isSelected ? 0.12 : isHoverPreviewing ? 0.06 : 0.02}
							>
								<div
									onClick={() => {
										unlockAudio();
										onSelect(midi.id);
									}}
									onDoubleClick={() => handlePlay(midi.id)}
									className="flex h-full w-full items-center justify-between px-7 cursor-pointer"
								>
									<div className="flex-1 min-w-0 flex flex-col">
										<div
											className={`text-lg italic font-semibold tracking-wide truncate text-left ${
												isSelected ? "text-white" : "text-white/85"
											}`}
										>
											{formatTitle(midi)}
										</div>
										<div className="text-[11px] italic text-white/40 truncate text-left flex items-center gap-2 mt-0.5">
											<span>by {midi.submitterUsername ?? "anonymous"}</span>
											<span className="text-white/25">·</span>
											<span>{formatDuration(midi.durationSeconds)}</span>
											<span className="text-white/25">·</span>
											<span>{midi.bpm} BPM</span>
											{isHoverPreviewing && (
												<>
													<span className="text-white/25">·</span>
													<span className="text-violet-200/80">previewing…</span>
												</>
											)}
										</div>
									</div>

									<div className="flex items-center gap-3 shrink-0 ml-4">
										<DifficultyBadge difficulty={midi.difficulty} />

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												handleAddToCustom(midi);
											}}
											disabled={busyId === midi.id}
											title={isAdded ? "Remove from your Custom songs" : "Add to your Custom songs"}
											className={`text-xs italic uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
												isAdded
													? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
													: "border-white/15 bg-white/5 text-white/80 hover:text-white hover:bg-white/10"
											}`}
										>
											{isAdded ? "Added to Custom" : "+ Add to Custom"}
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

function formatTitle(midi: CommunityMidi): string {
	return midi.artist ? `${midi.title} - ${midi.artist}` : midi.title;
}

function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "—";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
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
