// ============================================================================
// practice/difficulty.ts
// ----------------------------------------------------------------------------
// Heuristic that classifies a parsed MIDI as "easy" / "medium" / "hard" so
// the practice catalog can show a difficulty pill on each song row.
//
// The heuristic is a tiny additive scoring model:
//   * Note density (notes per second) — fast = harder.
//   * Max chord size — more simultaneous notes = harder.
//   * Tempo (BPM) — quick tempi push the rating up.
//   * Pitch range — wider span = more hand movement = harder.
//
// Thresholds were tuned by hand against ~30 reference MIDIs and chosen so
// most catalog entries land in "medium" with clear easy/hard tails.
// ============================================================================

import type { ParsedMidi } from "./midiParser";
import type { UploadDifficulty } from "./uploads";

// Window within which two note-ons count as "simultaneous" for chord-size
// detection. 50 ms is generous — captures human-played MIDIs where chord
// notes are intentionally non-simultaneous.
const CHORD_WINDOW_SECONDS = 0.05;

// Main entry. Empty MIDIs default to "easy" so the UI doesn't show a scary
// label on broken files.
export function estimateDifficulty(midi: ParsedMidi): UploadDifficulty {
	if (midi.notes.length === 0 || midi.durationSeconds <= 0) return "easy";

	const notesPerSecond = midi.notes.length / midi.durationSeconds;
	const maxSimultaneous = computeMaxSimultaneousNotes(midi);
	const bpm = midi.initialTempoBpm;

	let score = 0;

	// Density buckets: 8+ NPS is virtuosic, 5+ is brisk, 2.5+ is moderate.
	if (notesPerSecond > 8) score += 3;
	else if (notesPerSecond > 5) score += 2;
	else if (notesPerSecond > 2.5) score += 1;

	// Chord-size buckets: 6+ usually means two-hand voicings or pedalled
	// arpeggios, 4-5 covers most pop ballad chords, 3 is a triad.
	if (maxSimultaneous >= 6) score += 3;
	else if (maxSimultaneous >= 4) score += 2;
	else if (maxSimultaneous >= 3) score += 1;

	// Tempo buckets: 160+ is genuinely fast, 120+ is up-tempo.
	if (bpm >= 160) score += 2;
	else if (bpm >= 120) score += 1;

	// Wide range = lots of hand travel.
	const range = computePitchRange(midi);
	if (range >= 48) score += 1; // 4 octaves

	// Final classification.
	if (score >= 6) return "hard";
	if (score >= 3) return "medium";
	return "easy";
}

// Maximum number of notes that start within `CHORD_WINDOW_SECONDS` of each
// other. O(n) per-note scan with an early break thanks to the sorted-start
// invariant (callers always pass parsed MIDIs whose notes are time-sorted).
function computeMaxSimultaneousNotes(midi: ParsedMidi): number {
	let maxConcurrent = 0;
	const notes = midi.notes;
	for (let i = 0; i < notes.length; i++) {
		const start = notes[i].startSeconds;
		let concurrent = 0;
		// Scan forward only — sorted starts mean anything earlier is already
		// outside the window.
		for (let j = i; j < notes.length; j++) {
			const cur = notes[j];
			if (cur.startSeconds > start + CHORD_WINDOW_SECONDS) break;
			concurrent++;
		}
		if (concurrent > maxConcurrent) maxConcurrent = concurrent;
	}
	return maxConcurrent;
}

// Highest-MIDI minus lowest-MIDI. Returns 0 for empty / pathological inputs
// rather than ±Infinity, so the score math stays well-behaved.
function computePitchRange(midi: ParsedMidi): number {
	let lo = Infinity;
	let hi = -Infinity;
	for (const note of midi.notes) {
		if (note.midi < lo) lo = note.midi;
		if (note.midi > hi) hi = note.midi;
	}
	if (!isFinite(lo) || !isFinite(hi)) return 0;
	return hi - lo;
}
