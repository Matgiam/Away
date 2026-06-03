// ============================================================================
// useAppRouter.ts
// ----------------------------------------------------------------------------
// Thin wrapper around Next.js's `useRouter` that:
//   1. Fires the global "navigation started" event before every push/replace/back
//      so the NavigationIndicator's top progress bar can show *immediately* —
//      Next's own loading UI doesn't appear until the RSC payload starts loading.
//   2. Dedupes `prefetch()` calls per-instance, so wiring it up to hover /
//      focus handlers is cheap.
//
// Drop-in replacement for `useRouter` for in-app navigation. Don't mix the two
// — using the bare `useRouter` for some pushes leaves those without the
// progress bar flash.
// ============================================================================

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
	// Per-hook prefetch cache. Re-mounting the consumer clears it, but that's
	// fine — Next caches the response anyway, we just save one router call.
	const prefetched = useRef<Set<string>>(new Set());

	// All three navigators share the same pattern: notify, then delegate.
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

	// Idempotent prefetch — subsequent calls for the same href are no-ops.
	// No `notifyNavigationStart` here since prefetch shouldn't flash the bar.
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
