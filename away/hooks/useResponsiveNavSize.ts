// ============================================================================
// useResponsiveNavSize.ts
// ----------------------------------------------------------------------------
// Navigation bar dimensions (button size, pill width/height, gap).
//
// The whole app is authored at a fixed 1920×1080 reference and rendered inside
// a stage that is uniformly scaled to fit any screen (see lib/appScale.ts and
// globals.css `.app-stage`). That means the nav is always sized at the
// reference values here and the stage transform shrinks/grows it to match the
// viewport — so this hook no longer needs to read window.innerWidth (doing so
// would double-scale the nav). It's kept as a hook so callers don't change.
// ============================================================================

"use client";

// Returned size payload. All values are integer pixels.
export type NavSize = {
	button: number;
	pillWidth: number;
	pillHeight: number;
	gap: number;
};

// The reference-design nav size (tuned at 1920×1080).
const REFERENCE_SIZE: NavSize = {
	button: 67,
	pillWidth: 250,
	pillHeight: 60,
	gap: 20,
};

export function useResponsiveNavSize(): NavSize {
	return REFERENCE_SIZE;
}
