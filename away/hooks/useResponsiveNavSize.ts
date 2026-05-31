"use client";

import { useEffect, useState } from "react";

// Computes nav button + pill dimensions from the current viewport. The
// DynamicLiquidGlass component needs numeric width/height (it paints a canvas
// at that exact pixel resolution) so CSS clamp() isn't an option — this hook
// fills the gap by recomputing on every resize.
//
// Defaults match the "looks good on 1080p" baseline that was hardcoded
// throughout the nav before. SSR returns these defaults, then the post-mount
// effect kicks in with the real viewport size — no hydration mismatch.

export type NavSize = {
	/** Square icon button (record, settings, etc.) side length. */
	button: number;
	/** Soundfont pill width (the "Bright Grand" label). */
	pillWidth: number;
	/** Soundfont pill height. */
	pillHeight: number;
	/** Gap between buttons in the right-side grid. */
	gap: number;
};

const DEFAULT_SIZE: NavSize = {
	button: 67,
	pillWidth: 250,
	pillHeight: 60,
	gap: 20,
};

function compute(vw: number, vh: number): NavSize {
	// Anchor button size to viewport height so it stays proportional on
	// short laptops (768px) AND big monitors (1440p+). Clamp so it never
	// becomes unreadably small or absurdly large.
	const button = Math.round(Math.max(48, Math.min(67, vh * 0.075)));
	// Pill width anchors to viewport width since it's a wide horizontal
	// element. Keep it below 22% of width so it doesn't dominate the corner.
	const pillWidth = Math.round(Math.max(170, Math.min(250, vw * 0.18)));
	const pillHeight = Math.round(Math.max(46, Math.min(60, vh * 0.067)));
	// Smaller gap on tighter screens so the 3-column grid still fits.
	const gap = Math.round(Math.max(12, Math.min(20, vh * 0.022)));
	return { button, pillWidth, pillHeight, gap };
}

export function useResponsiveNavSize(): NavSize {
	const [size, setSize] = useState<NavSize>(DEFAULT_SIZE);

	useEffect(() => {
		function update() {
			setSize(compute(window.innerWidth, window.innerHeight));
		}
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return size;
}
