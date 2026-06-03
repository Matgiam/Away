// ============================================================================
// playerColors.ts
// ----------------------------------------------------------------------------
// Per-player colour palettes used for piano keys, falling notes, and
// visualizer rectangles in multiplayer rooms.
//
// There are three variants of the same hue set:
//   * BASE / SOLID         — the canonical colour for chips, badges, etc.
//   * WHITE  variant       — lighter; legible when painted on a WHITE key.
//   * BLACK  variant       — darker;  legible when painted on a BLACK key.
//
// Each palette has 8 entries — the maximum number of simultaneous players in
// a jam room. Colour assignment is positional: the i-th user in the room
// presence list gets the i-th colour.
// ============================================================================

// Base player palette — kept for backwards-compatible imports.
export const PLAYER_COLORS = [
	"#db5361", // red
	"#5396db", // blue
	"#53db96", // green
	"#c88cdb", // purple
	"#db8c53", // orange
	"#53dbdb", // cyan
	"#db53b0", // pink
	"#dbcc53", // yellow
];

// Same palette, re-exported under the "SOLID" alias used by newer call sites.
export const PLAYER_COLORS_SOLID = [
	"#db5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
	"#db8c53",
	"#53dbdb",
	"#db53b0",
	"#dbcc53",
];

// Lighter shades — used on WHITE piano keys / visualizer notes
// so the colour reads cleanly against a bright key.
export const PLAYER_COLORS_WHITE = [
	"#ce3b4c",
	"#7cb2e8",
	"#7ce8b2",
	"#d8aae8",
	"#e8a47c",
	"#7ce8e8",
	"#e87cc3",
	"#e8da7c",
];

// Same as PLAYER_COLORS_WHITE — kept under the SOLID name to match the
// naming used by `getKeySolidColor` below.
export const PLAYER_COLORS_SOLID_WHITE = [
	"#ce3b4c",
	"#7cb2e8",
	"#7ce8b2",
	"#d8aae8",
	"#e8a47c",
	"#7ce8e8",
	"#e87cc3",
	"#e8da7c",
];

// Darker shades — used on BLACK piano keys / visualizer notes
// so the colour stays bold against a dark key.
export const PLAYER_COLORS_BLACK = [
	"#af3240",
	"#326eaf",
	"#32af6e",
	"#9b5faf",
	"#af6f3a",
	"#32afaf",
	"#af328c",
	"#afa232",
];

// Same as PLAYER_COLORS_BLACK — kept under the SOLID name to match the
// naming used by `getKeySolidColor` below.
export const PLAYER_COLORS_SOLID_BLACK = [
	"#af3240",
	"#326eaf",
	"#32af6e",
	"#9b5faf",
	"#af6f3a",
	"#32afaf",
	"#af328c",
	"#afa232",
];

// Used as a safe fallback when no presence list is available (e.g. single-
// player free-play view, where the local user is implicitly "player 0").
export const DEFAULT_NOTE_COLOR_INDEX = 0;

// Returns the palette index for the current user given the ordered list of
// users in the room. -1 (not found) collapses to 0 so colour assignment is
// deterministic even before presence has fully synced.
export function getColorIndex(usersOnline: string[], myId: string): number {
	const idx = usersOnline.indexOf(myId);
	return idx === -1 ? 0 : idx;
}

// Solid base colour for the given palette index. `% length` lets the palette
// wrap if more than 8 users ever join (defensive — UI caps at 8).
export function getSolidColor(index: number): string {
	return PLAYER_COLORS_SOLID[index % PLAYER_COLORS_SOLID.length];
}

// Pick the lighter/darker variant depending on whether the surface being
// painted is a black key or a white key.
export function getVisualizerColor(index: number, isBlack: boolean): string {
	const palette = isBlack ? PLAYER_COLORS_BLACK : PLAYER_COLORS_WHITE;
	return palette[index % palette.length];
}

// Same as `getVisualizerColor` but explicitly named for the piano-key
// renderer (kept separate in case the two diverge later).
export function getKeySolidColor(index: number, isBlack: boolean): string {
	const palette = isBlack ? PLAYER_COLORS_SOLID_BLACK : PLAYER_COLORS_SOLID_WHITE;
	return palette[index % palette.length];
}
