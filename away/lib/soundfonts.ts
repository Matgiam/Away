// ============================================================================
// soundfonts.ts
// ----------------------------------------------------------------------------
// Client-side fetch + shape-normalisation for the soundfont catalog.
//
// The catalog itself is built server-side by `app/api/instruments/route.ts`,
// which walks `public/instruments/` and returns one entry per `.sf2` / `.sf3`
// file found. This module:
//
//   1. Hits that endpoint from the browser.
//   2. Normalises the (loosely-typed) JSON into the strongly-typed
//      `Instrument` shape the rest of the app expects.
//   3. Coerces unknown / missing category strings into "Other" so the
//      soundfont picker never crashes on an unrecognised value.
//
// Returns an empty map on any failure — callers can then fall back to the
// `DEFAULT_SOUNDFONT` baked into `types.ts`.
// ============================================================================

import type { Instrument, SoundfontCategory } from "./types";
import { SOUNDFONT_CATEGORIES } from "./types";

// Raw API shape — `category` is optional and free-form because the server
// route derives it from the folder name on disk.
type ApiInstrument = {
	key: string;
	name: string;
	url: string;
	category?: string;
	format: "sf2" | "sf3";
};

// Snap any incoming category string to one of the known buckets, or "Other"
// if it doesn't match (case-insensitive comparison).
function normalizeCategory(raw?: string): SoundfontCategory {
	if (!raw) return "Other";
	const match = SOUNDFONT_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
	return match ?? "Other";
}

// Fetches the catalog from /api/instruments. The endpoint scans
// public/instruments/ at request time so adding a new .sf2/.sf3 just means
// dropping the file into the folder and refreshing.
export async function fetchDynamicSoundfonts(): Promise<Record<string, Instrument>> {
	try {
		const res = await fetch("/api/instruments");
		if (!res.ok) return {}; // 4xx/5xx — caller falls back to defaults
		const list = (await res.json()) as ApiInstrument[];
		const map: Record<string, Instrument> = {};
		for (const f of list) {
			map[f.key] = {
				name: f.name,
				url: f.url,
				category: normalizeCategory(f.category),
				format: f.format,
			};
		}
		return map;
	} catch {
		// Network failure / JSON parse error → empty map. The picker shows
		// no instruments rather than crashing.
		return {};
	}
}
