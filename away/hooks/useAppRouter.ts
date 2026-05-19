"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { notifyNavigationStart } from "@/lib/navigation";

// Wraps Next's router so that every programmatic navigation:
//   1. Dispatches the global navigation-start event (so NavigationIndicator's top bar
//      lights up the moment the user clicks, with no perceptible delay).
//   2. Goes through prefetch-deduped prefetch() — calling it for the same URL many times
//      in a session is cheap (and useful for hover/select handlers).
export function useAppRouter() {
	const router = useRouter();
	const prefetched = useRef<Set<string>>(new Set());

	const push = useCallback(
		(href: string) => {
			notifyNavigationStart();
			router.push(href);
		},
		[router],
	);

	const replace = useCallback(
		(href: string) => {
			notifyNavigationStart();
			router.replace(href);
		},
		[router],
	);

	const back = useCallback(() => {
		notifyNavigationStart();
		router.back();
	}, [router]);

	const prefetch = useCallback(
		(href: string) => {
			if (prefetched.current.has(href)) return;
			prefetched.current.add(href);
			router.prefetch(href);
		},
		[router],
	);

	// Stable object reference so consumers can safely depend on this in useEffect/useMemo.
	return useMemo(
		() => ({ push, replace, back, prefetch }),
		[push, replace, back, prefetch],
	);
}
