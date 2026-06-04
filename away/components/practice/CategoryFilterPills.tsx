// ============================================================================
// practice/CategoryFilterPills.tsx
// ----------------------------------------------------------------------------
// Horizontal pill row used to sub-categorize the Custom and Community song
// lists. Visually echoes DifficultyBadge / "Add to Custom" — small rounded
// chips with a faint border, glowing when active — so it sits naturally in
// the existing aesthetic without overpowering the main category sidebar.
//
// The "All" option clears the filter; "Uncategorized" matches rows whose
// category column is null (legacy uploads, plus any the user didn't tag).
// ============================================================================

"use client";

import { SONG_CATEGORIES, type SongCategoryKey } from "@/lib/practice/songs";

// What the parent stores. `null` = "All" (no filter); "uncategorized" matches
// rows whose category is null; any SongCategoryKey filters by exact match.
export type SubCategoryFilter = SongCategoryKey | "uncategorized" | null;

interface CategoryFilterPillsProps {
	active: SubCategoryFilter;
	onChange: (next: SubCategoryFilter) => void;
	// Optional row counts per bucket — when provided, rendered next to the label
	// so the user knows how many songs they'll see before clicking.
	counts?: Partial<Record<NonNullable<SubCategoryFilter> | "all", number>>;
}

// Compose once at module load — these are the choices, in display order.
const PILL_ITEMS: { key: SubCategoryFilter; label: string }[] = [
	{ key: null, label: "All" },
	...SONG_CATEGORIES.map((c) => ({ key: c.key as SubCategoryFilter, label: c.label })),
	{ key: "uncategorized", label: "Uncategorized" },
];

// Use a stable string for keying / counts lookup. `null` becomes "all".
function pillKey(k: SubCategoryFilter): string {
	return k ?? "all";
}

export function CategoryFilterPills({ active, onChange, counts }: CategoryFilterPillsProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{PILL_ITEMS.map((item) => {
				const isActive = item.key === active;
				const k = pillKey(item.key);
				const count = counts?.[k as keyof typeof counts];
				return (
					<button
						key={k}
						type="button"
						onClick={() => onChange(item.key)}
						className={`text-[11px] uppercase tracking-widest italic px-3 py-1.5 rounded-full border transition-colors ${
							isActive
								? "border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.06)]"
								: "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/90 hover:bg-white/8"
						}`}
					>
						{item.label}
						{typeof count === "number" && (
							<span className={`ml-1.5 tabular-nums ${isActive ? "text-white/70" : "text-white/35"}`}>
								{count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
