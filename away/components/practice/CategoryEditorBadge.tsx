// ============================================================================
// practice/CategoryEditorBadge.tsx
// ----------------------------------------------------------------------------
// Small clickable badge rendered on each Custom song row. Shows the row's
// current category and opens a popover menu where the owner can move the
// song between categories without leaving the list.
//
// Read-only callers (e.g. Community rows) can pass `readOnly` to render the
// chip as a plain label.
//
// The popover renders through a React portal anchored at the document body.
// The row above is wrapped in DynamicLiquidGlass which sets `contain: paint`,
// and that clip context swallows any popover positioned with `absolute` or
// `fixed` *inside* the wrapper. Escaping into a portal sidesteps the issue
// and lets the menu open above whatever's beneath the row.
// ============================================================================

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SONG_CATEGORIES, type SongCategoryKey } from "@/lib/practice/songs";

interface CategoryEditorBadgeProps {
	value: SongCategoryKey | null;
	onChange?: (next: SongCategoryKey | null) => void;
	readOnly?: boolean;
}

// Pretty label for the current value. Centralised so the badge text and the
// popover-selected text stay in sync.
function labelFor(value: SongCategoryKey | null): string {
	if (!value) return "Uncategorized";
	return SONG_CATEGORIES.find((c) => c.key === value)?.label ?? "Uncategorized";
}

// Approximate menu dimensions used to flip the popover above the badge when
// there isn't enough room below. Exact pixel-accuracy isn't required — the
// flip is just there to avoid the menu running off the bottom of the viewport.
const MENU_WIDTH = 200;
const MENU_HEIGHT = 320;
const MENU_GAP = 8;

export function CategoryEditorBadge({ value, onChange, readOnly = false }: CategoryEditorBadgeProps) {
	const [open, setOpen] = useState(false);
	const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	// Position the popover relative to the badge each time it opens. We re-read
	// on every open rather than caching because the row can have scrolled or
	// the viewport could have resized between opens.
	const positionMenu = () => {
		const btn = buttonRef.current;
		if (!btn) return;
		const rect = btn.getBoundingClientRect();
		const fitsBelow = rect.bottom + MENU_GAP + MENU_HEIGHT <= window.innerHeight;
		const top = fitsBelow ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - MENU_HEIGHT;
		// Right-align the menu with the badge so it stays glued to the chip
		// when the row is wider than the menu.
		const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
		setCoords({ top, left });
	};

	// Close on click outside / Escape / scroll. Mounted only while the popover
	// is open so idle rows don't burn listener slots.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (buttonRef.current?.contains(target)) return;
			if (menuRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		// Any scroll in the page (the list, the viewport, anything inside)
		// detaches the menu from its anchor. Close instead of trying to follow.
		const onScroll = () => setOpen(false);
		const onResize = () => positionMenu();
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onResize);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onResize);
		};
	}, [open]);

	// Compute coords before the first paint so the menu doesn't flash at (0,0).
	useLayoutEffect(() => {
		if (open) positionMenu();
	}, [open]);

	const label = labelFor(value);
	const baseChip =
		"text-[10px] uppercase tracking-widest italic px-2.5 py-1 rounded-full border transition-colors";
	const colorClass = value
		? "border-violet-300/35 bg-violet-500/12 text-violet-100/95"
		: "border-white/15 bg-white/5 text-white/55";

	if (readOnly) {
		return <span className={`${baseChip} ${colorClass}`}>{label}</span>;
	}

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setOpen((v) => !v);
				}}
				title="Change category"
				className={`${baseChip} ${colorClass} hover:bg-white/12 hover:text-white cursor-pointer`}
			>
				{label}
			</button>
			{open && coords && typeof document !== "undefined" &&
				createPortal(
					<div
						ref={menuRef}
						onClick={(e) => e.stopPropagation()}
						style={{
							position: "fixed",
							top: coords.top,
							left: coords.left,
							width: MENU_WIDTH,
							zIndex: 1000,
						}}
						className="py-2 rounded-xl border border-white/10 bg-[#0d0620]/95 backdrop-blur-xl shadow-2xl"
					>
						<CategoryOption
							label="Uncategorized"
							active={value === null}
							onClick={() => {
								onChange?.(null);
								setOpen(false);
							}}
						/>
						<div className="h-px bg-white/5 my-1" />
						{SONG_CATEGORIES.map((c) => (
							<CategoryOption
								key={c.key}
								label={c.label}
								active={value === c.key}
								onClick={() => {
									onChange?.(c.key);
									setOpen(false);
								}}
							/>
						))}
					</div>,
					document.body,
				)}
		</>
	);
}

// One row in the popover menu. Active state shows a small dot indicator on
// the left so the current value is obvious at a glance.
function CategoryOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-4 py-1.5 text-sm italic flex items-center gap-3 transition-colors ${
				active ? "text-white bg-white/8" : "text-white/70 hover:text-white hover:bg-white/5"
			}`}
		>
			<span
				className={`w-1.5 h-1.5 rounded-full ${active ? "bg-violet-300" : "bg-transparent"}`}
				aria-hidden
			/>
			<span>{label}</span>
		</button>
	);
}
