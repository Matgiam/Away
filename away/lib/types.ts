// ============================================================================
// types.ts
// ----------------------------------------------------------------------------
// Shared TypeScript types and constants used across the audio engine, piano
// renderer, visualizer, and soundfont picker.
//
// Nothing here has runtime behaviour — it's all type definitions plus a couple
// of constant tables (categories, theme colour, soundfont catalog placeholder).
// ============================================================================

// One piano key, as understood by the renderer and the audio engine.
// `whiteKeyIndex` is what positions the key horizontally on screen: black keys
// are positioned relative to the white key just to their left.
export type PianoKey = {
	midi: number;          // MIDI note number (21–108 for an 88-key piano)
	noteName: string;      // e.g. "C4", "F#5"
	isBlack: boolean;      // black-key flag (controls colour / hit area)
	whiteKeyIndex: number; // index among white keys only (used for layout)
	color: string;         // resolved colour (theme + player tint applied)
};

// One falling-note rectangle drawn by the visualizer (and the practice
// falling-notes view). Times are in seconds; `endTime` is null while the note
// is still being held (note-off hasn't arrived yet).
export type VisNote = {
	id: string;            // unique per note instance — used as React key
	midi: number;
	startTime: number;     // when the note was struck (audio context time)
	endTime: number | null;// when it was released; null = still held
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
	x: number;             // px offset within the piano viewport
	w: number;             // px width (different for black vs white keys)
	playerId: string;      // which peer this note came from (for multi-player tinting)
};

// Translucent brand red — used as a default highlight colour anywhere a
// player-specific tint isn't available yet.
export const THEME_COLOR = "rgba(219, 83, 97, 0.5)";

// User-facing buckets shown in the soundfont picker UI. The strings here are
// the labels the user actually sees, so renaming one is a UI change.
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

// One soundfont entry — what the picker shows and what the engine loads.
export type Instrument = {
	name: string;                   // display name
	url: string;                    // /instruments/... path served by /public
	category: SoundfontCategory;    // which bucket it falls into
	format: "sf2" | "sf3";          // file format (spessasynth handles both)
};

// Catalog of locally-bundled SoundFont files. Populated at runtime from
// /api/instruments which scans public/instruments. Kept empty here so the
// engine doesn't load anything before the catalog arrives.
export const instruments: Record<string, Instrument> = {};

// Default soundfont key — Bright Grand. Used as the initial selection
// before the user has expressed a preference.
export const DEFAULT_SOUNDFONT = "keyboards_bright_grand";
