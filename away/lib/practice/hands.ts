// ============================================================================
// practice/hands.ts
// ----------------------------------------------------------------------------
// Assigns each note in a parsed MIDI to a hand (right / left) so the falling-
// notes view can render them in two columns / colours.
//
// Strategy:
//   * Most engraved MIDIs have one track per staff. So if the file has 2+
//     tracks with notes, we pick the highest-averaging track for the right
//     hand and the rest for the left.
//   * Single-track MIDIs fall back to a pitch threshold (middle C): notes at
//     or above middle C are right-hand, below are left-hand. Imperfect but
//     gives reasonable results for everything we've thrown at it.
// ============================================================================

import type { ParsedMidi, ParsedNote } from "./midiParser";

export type Hand = "right" | "left";

// Closure-based assignment so callers can do `assign(note)` per-note without
// re-running the per-MIDI track analysis every time.
export type HandAssignment = (note: ParsedNote) => Hand;

const MIDDLE_C = 60;

// Returns a per-note classifier configured for this specific MIDI.
export function buildHandAssignment(midi: ParsedMidi): HandAssignment {
	// First: compute each track's average pitch — proxy for "is this the
	// melody track (high) or the bass track (low)?".
	const trackAverages = new Map<number, { sum: number; count: number }>();
	for (const note of midi.notes) {
		const entry = trackAverages.get(note.track) ?? { sum: 0, count: 0 };
		entry.sum += note.midi;
		entry.count += 1;
		trackAverages.set(note.track, entry);
	}

	// Sort tracks by average pitch descending — highest first = right hand.
	const activeTracks = Array.from(trackAverages.entries())
		.filter(([, v]) => v.count > 0)
		.map(([track, v]) => ({ track, avg: v.sum / v.count }))
		.sort((a, b) => b.avg - a.avg);

	if (activeTracks.length >= 2) {
		// Two or more tracks → first goes to right hand, rest to left.
		const trackHands = new Map<number, Hand>();
		for (let i = 0; i < activeTracks.length; i++) {
			trackHands.set(activeTracks[i].track, i === 0 ? "right" : "left");
		}
		// Fallback inside the closure: if a note shows up on an unknown track,
		// classify by pitch.
		return (note) => trackHands.get(note.track) ?? (note.midi >= MIDDLE_C ? "right" : "left");
	}

	// Single-track MIDI → split on middle C.
	return (note) => (note.midi >= MIDDLE_C ? "right" : "left");
}
