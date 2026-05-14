"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { BuiltInSong } from "@/lib/practice/songs";

interface SongListProps {
	songs: BuiltInSong[];
	selectedId: string | null;
	onSelect: (song: BuiltInSong) => void;
	onPlay: (song: BuiltInSong) => void;
	emptyMessage?: string;
}

export function SongList({ songs, selectedId, onSelect, onPlay, emptyMessage }: SongListProps) {
	if (songs.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center text-white/50 italic">
				{emptyMessage ?? "No songs match this search."}
			</div>
		);
	}

	return (
		<div className="practice-song-list h-full w-full overflow-y-auto pr-3 custom-scrollbar flex flex-col gap-4">
			{songs.map((song) => {
				const isSelected = song.id === selectedId;
				return (
					<button
						key={song.id}
						onClick={() => onSelect(song)}
						onDoubleClick={() => onPlay(song)}
						className="block w-full text-left transition-transform hover:scale-[1.005]"
					>
						<DynamicLiquidGlass
							width={720}
							height={86}
							radius={14}
							refractionLevel={0.7}
							specularOpacity={0.55}
							glassBgOpacity={isSelected ? 0.12 : 0.02}
						>
							<div className="flex h-full w-full items-center px-7">
								<span
									className={`text-xl italic font-semibold tracking-wide ${
										isSelected ? "text-white" : "text-white/80"
									}`}
								>
									{formatSongLine(song)}
								</span>
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
