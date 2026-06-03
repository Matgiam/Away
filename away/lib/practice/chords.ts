// ============================================================================
// practice/chords.ts
// ----------------------------------------------------------------------------
// Groups successive notes into "chord events" for the practice player.
//
// Why: practice mode pauses the song until the user plays the next chord. To
// know what counts as "the next chord" we need to collapse notes that fall
// within a small time window into a single event. 30 ms of slop is enough to
// catch human-played MIDIs (where chord notes are never perfectly simultaneous)
// without merging melodic passages that just happen to be fast.
//
// `chordIndexForTime` is a binary search used by the player to find the next
// chord to wait for given the current playback time.
// ============================================================================

import type { ParsedNote } from "./midiParser";

// One chord event — its on-time, the pitch-class set, and the original
// per-note records (kept around for velocity / track lookups).
export type Chord = {
	startSeconds: number;
	midis: number[];
	notes: ParsedNote[];
};

// 30 ms window — notes starting within this distance of each other are
// treated as a single chord. Tuned for typical recorded MIDIs.
const CHORD_GROUP_TOLERANCE_SECONDS = 0.03;

// Walk the notes in time order. Each note either:
//   * joins the last chord (its start is within the tolerance window), or
//   * opens a new chord.
export function buildChords(notes: ParsedNote[]): Chord[] {
	if (notes.length === 0) return [];
	const sorted = [...notes].sort((a, b) => a.startSeconds - b.startSeconds);
	const result: Chord[] = [];

	for (const note of sorted) {
		const last = result[result.length - 1];
		if (last && note.startSeconds - last.startSeconds < CHORD_GROUP_TOLERANCE_SECONDS) {
			// Joins the existing chord. Dedupe MIDIs in case the file actually
			// repeats the same pitch in two tracks at the same instant.
			last.notes.push(note);
			if (!last.midis.includes(note.midi)) last.midis.push(note.midi);
		} else {
			// Outside the window → fresh chord.
			result.push({
				startSeconds: note.startSeconds,
				midis: [note.midi],
				notes: [note],
			});
		}
	}
	return result;
}

// Classic binary search: returns the index of the first chord whose start
// time is >= `seconds`. If `seconds` is past the last chord, returns
// `chords.length`. The player uses this to know "what's the next thing the
// user has to hit?" relative to the current playhead.
export function chordIndexForTime(chords: Chord[], seconds: number): number {
	let lo = 0;
	let hi = chords.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1; // unsigned shift = integer divide, faster than Math.floor
		if (chords[mid].startSeconds < seconds) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}
