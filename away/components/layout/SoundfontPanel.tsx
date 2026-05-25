"use client";

import { useMemo, useState } from "react";
import type { SoundfontOption } from "@/hooks/useAudioEngine";
import { SOUNDFONT_CATEGORIES, type SoundfontCategory } from "@/lib/types";

interface SoundfontPanelProps {
	open: boolean;
	onClose: () => void;
	soundfonts: SoundfontOption[];
	currentSoundfont?: string;
	loadedSoundfonts: string[];
	loadingSoundfont: string | null;
	onSelectSoundfont?: (key: string) => void;
}

export const SoundfontPanel = ({
	open,
	onClose,
	soundfonts,
	currentSoundfont,
	loadedSoundfonts,
	loadingSoundfont,
	onSelectSoundfont,
}: SoundfontPanelProps) => {
	const grouped = useMemo(() => {
		const map = Object.fromEntries(
			SOUNDFONT_CATEGORIES.map((c) => [c, [] as SoundfontOption[]]),
		) as Record<SoundfontCategory, SoundfontOption[]>;
		for (const sf of soundfonts) {
			const cat: SoundfontCategory = SOUNDFONT_CATEGORIES.includes(sf.category) ? sf.category : "Other";
			map[cat].push(sf);
		}
		return map;
	}, [soundfonts]);

	const firstNonEmpty = useMemo<SoundfontCategory>(() => {
		const cats = SOUNDFONT_CATEGORIES as readonly SoundfontCategory[];
		return cats.find((c) => grouped[c].length > 0) ?? "Piano";
	}, [grouped]);

	const [activeCategory, setActiveCategory] = useState<SoundfontCategory>(firstNonEmpty);

	if (!open) return null;

	const list = grouped[activeCategory] ?? [];

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pb-40"
			onClick={onClose}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex"
				style={{ height: "80vh", maxHeight: "650px" }}
			>
				<aside className="w-64 shrink-0 border-r border-white/10 px-8 py-10 flex flex-col">
					<h2 className="text-white text-4xl font-light italic mb-14">Soundfont</h2>
					<nav className="flex flex-col gap-5">
						{SOUNDFONT_CATEGORIES.map((cat) => {
							const count = grouped[cat].length;
							return (
								<button
									key={cat}
									onClick={() => setActiveCategory(cat)}
									disabled={count === 0}
									className={`text-xl italic text-left transition-colors flex items-center justify-between gap-3 ${
										activeCategory === cat
											? "text-white font-medium"
											: count === 0
												? "text-white/15 cursor-not-allowed"
												: "text-white/30 hover:text-white/60"
									}`}
								>
									<span>{cat}</span>
									<span className="text-xs text-white/30 not-italic font-normal">
										{count > 0 ? count : ""}
									</span>
								</button>
							);
						})}
					</nav>
				</aside>

				<div className="flex-1 px-12 py-10 overflow-y-auto relative">
					<button
						onClick={onClose}
						className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
						aria-label="Close"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>

					<div className="flex flex-col gap-3 max-w-2xl pt-4">
						<span className="text-white/60 text-xs uppercase tracking-widest font-medium mb-1">
							{activeCategory} soundfonts
						</span>

						{list.length === 0 ? (
							<p className="text-white/40 text-sm">No soundfonts in this category yet.</p>
						) : (
							<ul className="space-y-2">
								{list.map((sf) => {
									const isActive = sf.key === currentSoundfont;
									const isLoaded = loadedSoundfonts.includes(sf.key);
									const isLoading = loadingSoundfont === sf.key;
									const dotClass = isActive
										? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
										: isLoaded
											? "bg-blue-400"
											: isLoading
												? "bg-yellow-400 animate-pulse"
												: "bg-white/20";
									const action = isActive ? "Active" : isLoading ? "Loading…" : isLoaded ? "Use" : "Load";
									return (
										<li key={sf.key}>
											<button
												onClick={() => onSelectSoundfont?.(sf.key)}
												disabled={isActive || isLoading}
												className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors ${
													isActive
														? "bg-white/10 border-white/25 text-white cursor-default"
														: "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
												} disabled:cursor-not-allowed`}
											>
												<div className="flex items-center gap-3 min-w-0">
													<span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
													<span className="text-sm truncate">{sf.name}</span>
												</div>
												<span
													className={`text-xs font-medium px-2 py-1 rounded ${
														isActive
															? "bg-green-500/20 text-green-300"
															: isLoading
																? "bg-yellow-500/20 text-yellow-300"
																: isLoaded
																	? "bg-blue-500/20 text-blue-300"
																	: "bg-white/10 text-white/60"
													}`}
												>
													{action}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
