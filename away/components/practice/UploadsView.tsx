"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { UploadDifficulty, UploadedSongMeta } from "@/lib/practice/uploads";

interface UploadsViewProps {
	uploads: UploadedSongMeta[];
	loading: boolean;
	signedIn: boolean;
	selectedId: string | null;
	onSelect: (id: string) => void;
	onPlay: (id: string) => void;
	onDelete: (id: string) => void;
	onUploadClick: () => void;
}

export function UploadsView({
	uploads,
	loading,
	signedIn,
	selectedId,
	onSelect,
	onPlay,
	onDelete,
	onUploadClick,
}: UploadsViewProps) {
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

	if (uploads.length === 0) {
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
		<div className="practice-song-list h-full w-full overflow-y-auto pr-4 flex flex-col gap-3">
			<button
				type="button"
				onClick={onUploadClick}
				className="block transition-transform hover:scale-[1.005]"
			>
				<DynamicLiquidGlass
					width={680}
					height={64}
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

			{uploads.map((upload) => {
				const isSelected = upload.id === selectedId;
				return (
					<div
						key={upload.id}
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
							<div
								onClick={() => onSelect(upload.id)}
								onDoubleClick={() => onPlay(upload.id)}
								className="flex h-full w-full items-center justify-between px-7 cursor-pointer"
							>
								<div className="flex-1 min-w-0">
									<div
										className={`text-lg italic font-semibold tracking-wide truncate text-left ${
											isSelected ? "text-white" : "text-white/80"
										}`}
									>
										{formatTitle(upload)}
									</div>
								</div>
								<div className="flex items-center gap-3 shrink-0 ml-4">
									<DifficultyBadge difficulty={upload.difficulty} />
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											if (confirm(`Delete "${upload.title}"?`)) onDelete(upload.id);
										}}
										className="text-white/40 hover:text-rose-300 transition-colors"
										aria-label="Delete"
										title="Delete"
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
	);
}

function formatTitle(upload: UploadedSongMeta): string {
	if (upload.artist) return `${upload.title} - ${upload.artist}`;
	return upload.title;
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
