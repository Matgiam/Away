// Cross-component event used to signal that an in-app navigation has started, so the global
// NavigationIndicator can show a top progress bar immediately — before Next.js has finished
// loading the destination's RSC payload. The bar is hidden again when the URL changes.

export const NAVIGATION_START_EVENT = "away:navigation-start";

export function notifyNavigationStart(): void {
	if (typeof window === "undefined") return;
	try {
		window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
	} catch {}
}
