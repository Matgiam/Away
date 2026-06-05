// ============================================================================
// appScale.ts
// ----------------------------------------------------------------------------
// The whole UI is designed at a fixed 1920×1080 reference and uniformly scaled
// to fit any screen with a single CSS transform (see globals.css `.app-stage`
// and the inline script in app/layout.tsx). This means every PC sees an
// identical layout, letterboxed on non-16:9 screens.
//
// Most code needs nothing from this file — the transform is pure CSS. The only
// consumers are bits of JS that position elements with *absolute pixel*
// coordinates (popovers anchored via getBoundingClientRect). Those APIs report
// real-viewport pixels (already multiplied by the scale), but the inline px
// styles we then write are interpreted in *stage* pixels — so they must be
// converted by dividing by the current scale.
// ============================================================================

// Reference design size. Everything is authored as if the screen were exactly
// this big; the stage transform handles the rest.
export const BASE_W = 1920;
export const BASE_H = 1080;

// The uniform "contain" scale: largest factor that still fits the whole
// 1920×1080 stage inside the viewport. Matches the inline script in layout.tsx.
export function computeScale(vw: number, vh: number): number {
	return Math.min(vw / BASE_W, vh / BASE_H);
}

// Current stage scale (rendered px ÷ stage px). Reads the live `--app-scale`
// CSS variable so there is a single source of truth shared with the inline
// script (which keeps it updated on resize before React hydrates).
export function getAppScale(): number {
	if (typeof window === "undefined") return 1;
	const raw = getComputedStyle(document.documentElement).getPropertyValue("--app-scale");
	const v = parseFloat(raw);
	return Number.isFinite(v) && v > 0 ? v : 1;
}
