// ============================================================================
// navigation.ts
// ----------------------------------------------------------------------------
// Tiny cross-component event bus for the global navigation progress bar.
//
// Why this exists: Next.js doesn't fire its loading UI immediately when a
// `<Link>` is clicked — there's a noticeable delay while the RSC payload is
// requested. The top-of-screen progress bar (NavigationIndicator) needs to
// show *right away*, so any place that triggers an in-app nav (links, buttons,
// programmatic router.push) dispatches this event first.
//
// The NavigationIndicator listens for it, starts the bar animation, and then
// hides the bar again once the URL actually changes.
// ============================================================================

// Cross-component event used to signal that an in-app navigation has started, so the global
// NavigationIndicator can show a top progress bar immediately — before Next.js has finished
// loading the destination's RSC payload. The bar is hidden again when the URL changes.

// String constant kept in one place so both the dispatcher and the listener
// stay in sync (no risk of typos diverging silently).
export const NAVIGATION_START_EVENT = "away:navigation-start";

// Fire the event. SSR-safe (no-op on the server) and swallows any synchronous
// dispatchEvent errors — never want a UI flourish to break navigation itself.
export function notifyNavigationStart(): void {
	if (typeof window === "undefined") return;
	try {
		window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
	} catch {}
}
