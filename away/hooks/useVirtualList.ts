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
	const endReachedFiredRef = useRef(false);
	const lastItemCountRef = useRef(itemCount);

	const rowStride = itemHeight + gap;
	const totalHeight = itemCount === 0 ? 0 : itemCount * rowStride - gap;

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

	const startIndex = Math.max(0, Math.floor(scrollTop / rowStride) - overscan);
	const endIndex = Math.min(
		itemCount,
		Math.ceil((scrollTop + containerHeight) / rowStride) + overscan,
	);

	useEffect(() => {
		if (!onEndReached || itemCount === 0 || containerHeight === 0) return;
		const distanceFromBottom = totalHeight - (scrollTop + containerHeight);
		if (distanceFromBottom <= endReachedThreshold) {
			if (!endReachedFiredRef.current) {
				endReachedFiredRef.current = true;
				onEndReached();
			}
		} else {
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
