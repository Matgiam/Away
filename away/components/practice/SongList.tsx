"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { BuiltInSong } from "@/lib/practice/songs";

interface SongListProps {
	songs: BuiltInSong[];
	selectedId: string | null;
	completedIds?: ReadonlySet<string>;
	onSelect: (song: BuiltInSong) => void;
	onPlay: (song: BuiltInSong) => void;
	emptyMessage?: string;
}

function CheckBadge() {
	return (
		<span
			className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full border border-emerald-300/40 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_rgba(120,220,160,0.18)]"
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

export function SongList({ songs, selectedId, completedIds, onSelect, onPlay, emptyMessage }: SongListProps) {
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
				return (
					<button
						key={song.id}
						onClick={() => onSelect(song)}
						onDoubleClick={() => onPlay(song)}
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
							<div className="relative flex h-full w-full items-center justify-center px-7">
								<span
									className={`text-xl italic font-semibold tracking-wide text-center ${
										isSelected ? "text-white" : "text-white/80"
									}`}
								>
									{formatSongLine(song)}
								</span>
								{isCompleted && <CheckBadge />}
							</div>
						</DynamicLiquidGlass>
					</button>
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
