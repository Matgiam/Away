"use client";

import { useCallback, useEffect, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { PreviewButton, type PreviewButtonState } from "@/components/practice/PreviewButton";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useMidiPreview } from "@/hooks/useMidiPreview";
import type { BuiltInSong } from "@/lib/practice/songs";
import type { UploadDifficulty } from "@/lib/practice/uploads";

interface SongListProps {
	songs: BuiltInSong[];
	selectedId: string | null;
	completedIds?: ReadonlySet<string>;
	onSelect: (song: BuiltInSong) => void;
	onPlay: (song: BuiltInSong) => void;
	emptyMessage?: string;
}

const PREVIEW_SECONDS = 50;

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

export function SongList({ songs, selectedId, completedIds, onSelect, onPlay, emptyMessage }: SongListProps) {
	const preview = useMidiPreview();
	const { unlockAudio } = useAudioEngineContext();
	const [previewingId, setPreviewingId] = useState<string | null>(null);
	const [exportingId, setExportingId] = useState<string | null>(null);

	// Stop any in-flight preview when this list unmounts (user switches tabs, etc.)
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
		(song: BuiltInSong) => {
			unlockAudio();
			if (previewingId === song.id) {
				preview.stop();
				setPreviewingId(null);
				return;
			}
			setPreviewingId(song.id);
			preview.play(song.filePath, { maxDurationSec: PREVIEW_SECONDS });
		},
		[preview, previewingId, unlockAudio],
	);

	const handleExport = useCallback(async (song: BuiltInSong) => {
		setExportingId(song.id);
		try {
			const res = await fetch(song.filePath);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = exportFileName(song);
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err) {
			console.error("MIDI export failed", err);
			alert("Couldn't export this MIDI. Check your connection and try again.");
		} finally {
			setExportingId((current) => (current === song.id ? null : current));
		}
	}, []);

	if (songs.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center text-white/50 italic">
				{emptyMessage ?? "No songs match this search."}
			</div>
		);
	}

	return (
		<div className="practice-song-list h-full w-full overflow-y-auto pr-4 flex flex-col gap-3">
			{songs.map((song) => {
				const isSelected = song.id === selectedId;
				const isCompleted = !!completedIds?.has(song.id);
				const isThisPreviewing = previewingId === song.id;
				const previewState: PreviewButtonState =
					isThisPreviewing && preview.state === "loading"
						? "loading"
						: isThisPreviewing && preview.state === "playing"
							? "playing"
							: "idle";
				const isExporting = exportingId === song.id;
				return (
					<div
						key={song.id}
						className="block transition-transform hover:scale-[1.005]"
					>
						<DynamicLiquidGlass
							width={680}
							height={84}
							radius={14}
							refractionLevel={0.7}
							specularOpacity={0.55}
							glassBgOpacity={isSelected ? 0.12 : isThisPreviewing ? 0.07 : 0.02}
						>
							<div
								onClick={() => onSelect(song)}
								onDoubleClick={() => onPlay(song)}
								className="flex h-full w-full items-center justify-between px-6 cursor-pointer"
							>
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<PreviewButton
										state={previewState}
										onClick={(e) => {
											e.stopPropagation();
											togglePreview(song);
										}}
									/>
									<div className="flex-1 min-w-0 flex flex-col">
										<div
											className={`text-lg italic font-semibold tracking-wide truncate text-left ${
												isSelected ? "text-white" : "text-white/85"
											}`}
										>
											{formatSongLine(song)}
										</div>
										{(song.durationSeconds !== undefined || song.bpm !== undefined) && (
											<div className="text-[11px] italic text-white/40 truncate text-left flex items-center gap-2 mt-0.5">
												{song.durationSeconds !== undefined && (
													<span>{formatDuration(song.durationSeconds)}</span>
												)}
												{song.durationSeconds !== undefined && song.bpm !== undefined && (
													<span className="text-white/25">·</span>
												)}
												{song.bpm !== undefined && <span>{song.bpm} BPM</span>}
												{isThisPreviewing && preview.state !== "idle" && (
													<>
														<span className="text-white/25">·</span>
														<span className="text-violet-200/80">
															{preview.state === "loading" ? "loading…" : "previewing"}
														</span>
													</>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="flex items-center gap-3 shrink-0 ml-4">
									{isCompleted && <CompletedTick />}
									{song.difficulty && <DifficultyBadge difficulty={song.difficulty} />}

									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											void handleExport(song);
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
								</div>
							</div>
						</DynamicLiquidGlass>
					</div>
				);
			})}
		</div>
	);
}

function formatSongLine(song: BuiltInSong): string {
	if (song.artist) return `${song.title} - ${song.artist}`;
	if (song.subcategoryLabel) return `${song.title} - ${song.subcategoryLabel}`;
	return song.title;
}

function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "—";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function exportFileName(song: BuiltInSong): string {
	const base = formatSongLine(song);
	const safe = base
		.replace(/[\\/:*?"<>|]+/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const stem = safe || song.fileName.replace(/\.midi?$/i, "");
	return `${stem}.mid`;
}
