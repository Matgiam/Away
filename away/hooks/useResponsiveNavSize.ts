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

export type NavSize = {
	button: number;
	pillWidth: number;
	pillHeight: number;
	gap: number;
};

const REFERENCE_VW = 1920;

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

const DEFAULT_SIZE: NavSize = {
	button: 67,
	pillWidth: 250,
	pillHeight: 60,
	gap: 20,
};

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

export function useResponsiveNavSize(): NavSize {
	const [size, setSize] = useState<NavSize>(DEFAULT_SIZE);

	useEffect(() => {
		function update() {
			setSize(compute(window.innerWidth));
		}
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return size;
}
