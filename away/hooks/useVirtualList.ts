// ============================================================================
// useVirtualList.ts
// ----------------------------------------------------------------------------
// Fixed-height row virtualization for long lists.
//
// Why: rendering hundreds of practice songs / community MIDIs / recordings
// as plain DOM nodes burns memory and makes scrolling jank. This hook gives
// you just-enough state to render only the visible window plus a small
// overscan, while pretending to the scrollbar that the whole list is there.
//
// Caller is responsible for the actual layout. Use the returned values like:
//
//   <div ref={containerRef} onScroll={onScroll} style={{ overflowY: "auto" }}>
//     <div style={{ height: totalHeight, position: "relative" }}>
//       {items.slice(startIndex, endIndex).map((item, i) => (
//         <div
//           key={item.id}
//           style={{ position: "absolute", top: offsetForIndex(startIndex + i), height: itemHeight }}
//         >…</div>
//       ))}
//     </div>
//   </div>
//
// Also fires `onEndReached` once when the user scrolls to the bottom, used
// to drive "load more" for paginated sources (community library, etc.).
// ============================================================================

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface VirtualListOptions {
	itemCount: number;
	// Height of one row, in pixels.
	itemHeight: number;
	// Vertical gap between rows, in pixels.
	gap?: number;
	// Number of off-screen rows to keep mounted on each side. Higher = fewer
	// mount/unmount jumps while scrolling fast, at the cost of more live DOM.
	overscan?: number;
	// Called once when scroll gets within `endReachedThreshold` of the bottom.
	// Re-armed every time itemCount increases (so loading more re-enables firing).
	onEndReached?: () => void;
	endReachedThreshold?: number;
}

export interface VirtualListResult {
	containerRef: React.RefObject<HTMLDivElement | null>;
	onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
	// Height of the inner spacer needed to make the scrollbar accurate.
	totalHeight: number;
	// Index range of rows that should currently be rendered.
	startIndex: number;
	endIndex: number;
	// `top` offset for a given absolute index (matches the layout below).
	offsetForIndex: (index: number) => number;
	// Total stride between row-tops (itemHeight + gap).
	rowStride: number;
}

// Lightweight fixed-height row virtualization. Use when the list might exceed
// ~50 items — anything smaller doesn't benefit and the absolute-positioning
// layout is harder to debug than `flex flex-col gap-3`.
export function useVirtualList({
	itemCount,
	itemHeight,
	gap = 0,
	overscan = 4,
	onEndReached,
	endReachedThreshold = 250,
}: VirtualListOptions): VirtualListResult {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight, setContainerHeight] = useState(0);
	// Track last "fired" state so we don't repeatedly fire onEndReached at the bottom.
	const endReachedFiredRef = useRef(false);
	const lastItemCountRef = useRef(itemCount);

	// Row stride = height of one row + the gap below it.
	const rowStride = itemHeight + gap;
	// Trailing gap is removed so the spacer doesn't add phantom scroll past the last row.
	const totalHeight = itemCount === 0 ? 0 : itemCount * rowStride - gap;

	// Measure the container on mount and on resize. useLayoutEffect to avoid a
	// flash of "everything rendered" before the window math kicks in.
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		setContainerHeight(el.clientHeight);
		// ResizeObserver is widely supported; falls back gracefully if missing.
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerHeight(entry.contentRect.height);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Simple scroll handler — just records the offset; window math runs on render.
	const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(event.currentTarget.scrollTop);
	}, []);

	// Re-arm onEndReached whenever the list grows. Without this, a single
	// "loaded another page" event would never fire again because the ref stays
	// true while the user is still near the bottom.
	if (itemCount > lastItemCountRef.current) {
		endReachedFiredRef.current = false;
	}
	lastItemCountRef.current = itemCount;

	// Window math: subtract overscan from the start, add to the end.
	const startIndex = Math.max(0, Math.floor(scrollTop / rowStride) - overscan);
	const endIndex = Math.min(
		itemCount,
		Math.ceil((scrollTop + containerHeight) / rowStride) + overscan,
	);

	// End-reached detection. Re-runs on every relevant change so callers don't
	// have to remember to call us — they just hand over `onEndReached`.
	useEffect(() => {
		if (!onEndReached || itemCount === 0 || containerHeight === 0) return;
		const distanceFromBottom = totalHeight - (scrollTop + containerHeight);
		if (distanceFromBottom <= endReachedThreshold) {
			if (!endReachedFiredRef.current) {
				endReachedFiredRef.current = true;
				onEndReached();
			}
		} else {
			// Reset once the user scrolls back up — re-arms the trigger.
			endReachedFiredRef.current = false;
		}
	}, [
		scrollTop,
		containerHeight,
		totalHeight,
		itemCount,
		onEndReached,
		endReachedThreshold,
	]);

	// Pre-multiplied stride — saves callers from re-deriving the same value.
	const offsetForIndex = useCallback((index: number) => index * rowStride, [rowStride]);

	return {
		containerRef,
		onScroll,
		totalHeight,
		startIndex,
		endIndex,
		offsetForIndex,
		rowStride,
	};
}
