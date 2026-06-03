// ============================================================================
// practice/catalog.server.ts
// ----------------------------------------------------------------------------
// Server-only: walks public/midi/*, parses every .mid/.midi it finds, and
// returns a unified `BuiltInSong[]` catalog with pre-computed difficulty,
// duration, and BPM.
//
// Why server-side: parsing every bundled MIDI in the browser would add
// hundreds of KB of work per visit. By doing it once per server process and
// caching the result at module scope, the practice menu can show metadata
// (difficulty pill, duration string) without each row having to fetch and
// parse the file itself.
//
// The walk is depth-limited (MAX_DEPTH = 3) so a deeply-nested asset can't
// accidentally pull in the entire filesystem.
// ============================================================================

import "server-only";
import { readdir, readFile } from "fs/promises";
import path from "path";
import {
	BuiltInSong,
	SONG_CATEGORIES,
	SongCategoryKey,
	labelForSubcategory,
	prettifyFileName,
	songIdFromPath,
} from "./songs";
import { parseMidi } from "./midiParser";
import { estimateDifficulty } from "./difficulty";

// Resolved on the server — process.cwd() = the Next.js project root.
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIDI_ROOT = path.join(PUBLIC_DIR, "midi");
// Cap recursion depth so a misplaced symlink can't send us off into space.
const MAX_DEPTH = 3;

// Quick lookup so we can filter out unknown category folders without scanning them.
const CATEGORY_KEYS: Set<SongCategoryKey> = new Set(SONG_CATEGORIES.map((c) => c.key));

// Recursively walk `dir` collecting .mid/.midi files. Sub-folder names become
// the song's `subcategory` (e.g. video_games/zelda → subcategory "zelda").
async function collectMidi(
	dir: string,
	depth: number,
	category: SongCategoryKey,
	subcategory: string | null,
): Promise<BuiltInSong[]> {
	if (depth > MAX_DEPTH) return []; // depth cap

	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		// Missing folder is fine — categories that have no MIDIs simply show empty.
		return [];
	}

	const songs: BuiltInSong[] = [];

	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// First nested folder establishes the subcategory; deeper folders
			// keep it (we don't go to sub-sub-categories).
			const nextSubcategory = subcategory ?? entry.name.toLowerCase();
			songs.push(...(await collectMidi(full, depth + 1, category, nextSubcategory)));
			continue;
		}
		if (!entry.isFile()) continue;
		if (!/\.midi?$/i.test(entry.name)) continue; // skip non-MIDI files

		// Build a web-safe relative URL: /midi/popular/yellow.mid
		const relative = path.relative(PUBLIC_DIR, full).split(path.sep).join("/");
		const filePath = "/" + relative;
		const { title, artist } = prettifyFileName(entry.name);

		// Parse the MIDI on the server so the song list can show difficulty,
		// duration and BPM up-front without each row having to fetch + parse the
		// file from the browser. Failures here aren't fatal — we still surface
		// the song without metadata so it can be played as before.
		let durationSeconds: number | undefined;
		let bpm: number | undefined;
		let difficulty: BuiltInSong["difficulty"];
		try {
			const buffer = await readFile(full);
			// Slice the underlying ArrayBuffer to the exact range — Node Buffers
			// can share a larger pool, and @tonejs/midi expects a tight view.
			const parsed = parseMidi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
			durationSeconds = parsed.durationSeconds;
			bpm = parsed.initialTempoBpm;
			difficulty = estimateDifficulty(parsed);
		} catch (err) {
			console.warn(`[practice catalog] failed to parse ${relative}:`, err);
		}

		songs.push({
			id: songIdFromPath(filePath),
			title,
			artist,
			category,
			subcategory,
			subcategoryLabel: subcategory ? labelForSubcategory(subcategory) : null,
			filePath,
			fileName: entry.name,
			durationSeconds,
			bpm,
			difficulty,
		});
	}

	return songs;
}

// Cache the catalog at module scope. Built-in MIDIs are bundled with the deploy
// and don't change between requests, so we only need to walk the filesystem and
// parse ~all songs once per server process. Without this, every visit to
// /practice would re-parse every MIDI (a noticeable cold-start cost).
let cached: Promise<BuiltInSong[]> | null = null;

// Public entry point. Returns a sorted, fully-populated song list.
export async function getAllBuiltInSongs(): Promise<BuiltInSong[]> {
	if (!cached) {
		cached = (async () => {
			const all: BuiltInSong[] = [];
			// Walk one folder per category — anything outside the known
			// categories is ignored.
			for (const cat of SONG_CATEGORIES) {
				if (!CATEGORY_KEYS.has(cat.key)) continue;
				const dir = path.join(MIDI_ROOT, cat.key);
				const songs = await collectMidi(dir, 0, cat.key, null);
				all.push(...songs);
			}
			// Alphabetical by title (case-insensitive) so the list is stable
			// regardless of FS enumeration order.
			all.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
			return all;
		})().catch((err) => {
			// If the walk fails, throw away the cached rejection so the next call
			// can retry instead of being permanently broken.
			cached = null;
			throw err;
		});
	}
	return cached;
}
