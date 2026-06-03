// ============================================================================
// layout/NavigationIndicator.tsx
// ----------------------------------------------------------------------------
// Thin top-of-page progress bar that lights up the instant any in-app
// navigation starts, so the user gets immediate feedback (Next.js's own
// loading UI takes a beat longer to appear). Listens for the
// NAVIGATION_START_EVENT dispatched by `useAppRouter` and hides when the
// pathname changes.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/lib/navigation";

// Sits at the very top of every page (mounted from root layout). Shows a thin sliding bar
// the instant a navigation is triggered via useAppRouter, then hides itself when the
// pathname actually changes (which is when Next.js has loaded the new route).
export function NavigationIndicator() {
	const pathname = usePathname();
	const [active, setActive] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const onStart = () => setActive(true);
		window.addEventListener(NAVIGATION_START_EVENT, onStart);
		return () => window.removeEventListener(NAVIGATION_START_EVENT, onStart);
	}, []);

	useEffect(() => {
		// Pathname change = navigation finished. Add a small grace period so the bar
		// stays visible at least briefly even on near-instant prefetched navigations.
		if (!active) return;
		const timeout = setTimeout(() => setActive(false), 150);
		return () => clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	return (
		<div
			aria-hidden
			className={`fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none overflow-hidden transition-opacity duration-200 ${
				active ? "opacity-100" : "opacity-0"
			}`}
		>
			<div className="navigation-indicator-bar h-full" />
		</div>
	);
}
