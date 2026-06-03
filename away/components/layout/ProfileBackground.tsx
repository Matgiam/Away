// ============================================================================
// layout/ProfileBackground.tsx
// ----------------------------------------------------------------------------
// Thin wrapper around `<SilkBackground>` that reads the user's current
// background colour / animated / reduced-motion settings from localStorage
// and re-reads them whenever the settings change. Mounted on the profile
// page (the home page uses SilkBackground directly).
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { loadSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export function ProfileBackground() {
	const [bgColor, setBgColor] = useState(DEFAULT_SETTINGS.backgroundColor);
	const [animated, setAnimated] = useState(DEFAULT_SETTINGS.backgroundAnimated);
	const [reduced, setReduced] = useState(DEFAULT_SETTINGS.reducedMotion);

	useEffect(() => {
		const s = loadSettings();
		setBgColor(s.backgroundColor);
		setAnimated(s.backgroundAnimated);
		setReduced(s.reducedMotion);

		const handler = () => {
			const next = loadSettings();
			setBgColor(next.backgroundColor);
			setAnimated(next.backgroundAnimated);
			setReduced(next.reducedMotion);
		};
		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, []);

	return (
		<SilkBackground
			color={bgColor}
			scale={0.8}
			noiseIntensity={1.3}
			speed={3}
			rotation={180}
			animated={animated && !reduced}
		/>
	);
}
