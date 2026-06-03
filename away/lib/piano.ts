// ============================================================================
// piano.ts
// ----------------------------------------------------------------------------
// Generates the static 88-key piano model used by the Piano component and the
// visualizer. A full piano starts at A0 (MIDI 21) and ends at C8 (MIDI 108).
//
// For each MIDI note we work out:
//   * its note name + octave (e.g. "C4", "F#5")
//   * whether it's a black key or a white key (used for layout + colour)
//   * its `whiteKeyIndex` — the 0-based offset among WHITE keys only.
//     Black keys "borrow" the index of the white key just before them; the
//     renderer then offsets the black key visually to sit between two whites.
// ============================================================================

import { PianoKey } from "./types";
import { PLAYER_COLORS } from "./playerColors";

// Returns the full 88-key piano from A0 (21) to C8 (108) in MIDI order.
// Pure function — no side effects, safe to call on the server.
export const generatePiano = (): PianoKey[] => {
	const keys: PianoKey[] = [];
	let whiteKeyIndex = 0; // running counter — incremented only for white keys

	for (let midi = 21; midi <= 108; midi++) {
		// 12-note chromatic cycle; `midi % 12` gives the pitch class.
		const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		const noteName = notes[midi % 12];
		const isBlack = noteName.includes("#"); // every "#" is a black key

		keys.push({
			midi,
			// Octave: MIDI 12 = C0, so `floor(midi / 12) - 1` gives the octave number.
			noteName: `${noteName}${Math.floor(midi / 12) - 1}`,
			isBlack,
			// White key → assign and increment. Black key → reuse the previous white's
			// index so the renderer can position it between its two neighbours.
			whiteKeyIndex: !isBlack ? whiteKeyIndex++ : whiteKeyIndex - 1,
			color: PLAYER_COLORS[0], // placeholder; overwritten per-player at render time
		});
	}
	return keys;
};
