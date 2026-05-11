// Base player palette — kept for backwards-compatible imports.
export const PLAYER_COLORS = [
	"#db5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
	"#db8c53",
	"#53dbdb",
	"#db53b0",
	"#dbcc53",
];

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

export const DEFAULT_NOTE_COLOR_INDEX = 0;

export function getColorIndex(usersOnline: string[], myId: string): number {
	const idx = usersOnline.indexOf(myId);
	return idx === -1 ? 0 : idx;
}

export function getSolidColor(index: number): string {
	return PLAYER_COLORS_SOLID[index % PLAYER_COLORS_SOLID.length];
}

export function getVisualizerColor(index: number, isBlack: boolean): string {
	const palette = isBlack ? PLAYER_COLORS_BLACK : PLAYER_COLORS_WHITE;
	return palette[index % palette.length];
}

export function getKeySolidColor(index: number, isBlack: boolean): string {
	const palette = isBlack ? PLAYER_COLORS_SOLID_BLACK : PLAYER_COLORS_SOLID_WHITE;
	return palette[index % palette.length];
}
