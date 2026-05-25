export type PianoKey = {
	midi: number;
	noteName: string;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
};

export type VisNote = {
	id: string;
	midi: number;
	startTime: number;
	endTime: number | null;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
	x: number;
	w: number;
	playerId: string;
};

export const THEME_COLOR = "rgba(219, 83, 97, 0.5)";

export const SOUNDFONT_CATEGORIES = [
	"Piano",
	"Guitar",
	"Bass",
	"Strings",
	"Choirs",
	"Percussion",
	"Winds",
	"Synth",
	"Other",
] as const;
export type SoundfontCategory = (typeof SOUNDFONT_CATEGORIES)[number];

export type Instrument = {
	name: string;
	url: string;
	category: SoundfontCategory;
	format: "sf2" | "sf3";
};

// Catalog of locally-bundled SoundFont files. Populated at runtime from
// /api/instruments which scans public/instruments. Kept empty here so the
// engine doesn't load anything before the catalog arrives.
export const instruments: Record<string, Instrument> = {};

export const DEFAULT_SOUNDFONT = "keyboards_steinway_grand_piano";
