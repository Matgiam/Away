// ============================================================================
// useResponsiveNavSize.ts
// ----------------------------------------------------------------------------
// Computes the navigation bar dimensions (button size, pill width/height,
// gap) from the current viewport width.
//
// Design intent:
//   * Below the reference width (1920px) the nav scales linearly with the
//     viewport so a 1366×768 laptop sees the same proportions as a 1080p one.
//   * At or above 1920px the values *freeze*. Bigger monitors don't get
//     bigger UI — they get more empty space around the same nav.
//
// This avoids the usual "ultrawide makes everything look comically large"
// problem when scaling purely with vw units.
// ============================================================================

"use client";

import { useEffect, useState } from "react";

// Computes nav sizes from the viewport width. The key idea: there's a
// **reference** screen width (REFERENCE_VW = 1920px) where the design was
// dialed in. Below it we scale proportionally so 1366×768 laptops still look
// right. Above it we **freeze** at the reference values — bigger monitors
// don't blow up icons / pills to absurd sizes, they just show the same nav
// the user sees on their 1080p screen with more empty space around it.
//
// Reference math (all anchored at 1920px width):
//   button     67 / 1920 = 0.0349
//   pillWidth 250 / 1920 = 0.130
//   pillHeight 60 / 1920 = 0.0312
//   gap        20 / 1920 = 0.0104

// Returned size payload. All values are integer pixels (rounded).
export type NavSize = {
	button: number;
	pillWidth: number;
	pillHeight: number;
	gap: number;
};

// "1920px is what the design was tuned at" — anything wider clamps to this.
const REFERENCE_VW = 1920;

// Per-element ratios derived from the reference design. Multiply by the
// effective viewport width to get the pixel size.
const RATIO = {
	button: 0.0349,
	pillWidth: 0.13,
	pillHeight: 0.0312,
	gap: 0.0104,
} as const;

// Keeps the nav usable on extremely narrow screens (mobile portrait, narrow
// browser dev tools, etc.). Anything between ~1030px and 1920px uses pure vw
// scaling; anything ≥1920 px clamps to the reference values.
const MIN_BUTTON = 36;

// SSR default — matches the reference values so the server render doesn't
// look obviously wrong before the client measures the real viewport.
const DEFAULT_SIZE: NavSize = {
	button: 67,
	pillWidth: 250,
	pillHeight: 60,
	gap: 20,
};

// Pure pixel math — no state, no DOM access. Easy to unit-test.
function compute(vw: number): NavSize {
	// Cap at REFERENCE_VW so the nav never grows beyond what it looks like
	// on a 1920px screen. This is the "same look everywhere" guarantee.
	const effective = Math.min(vw, REFERENCE_VW);
	const button = Math.max(MIN_BUTTON, Math.round(effective * RATIO.button));
	return {
		button,
		pillWidth: Math.round(effective * RATIO.pillWidth),
		pillHeight: Math.round(effective * RATIO.pillHeight),
		gap: Math.round(effective * RATIO.gap),
	};
}

// Hook entry: returns the current size and updates on window resize.
export function useResponsiveNavSize(): NavSize {
	const [size, setSize] = useState<NavSize>(DEFAULT_SIZE);

	useEffect(() => {
		function update() {
			setSize(compute(window.innerWidth));
		}
		update(); // initial sync to actual viewport
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return size;
}
