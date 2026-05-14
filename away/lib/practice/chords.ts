import type { ParsedNote } from "./midiParser";

export type Chord = {
	startSeconds: number;
	midis: number[];
	notes: ParsedNote[];
};

const CHORD_GROUP_TOLERANCE_SECONDS = 0.03;

export function buildChords(notes: ParsedNote[]): Chord[] {
	if (notes.length === 0) return [];
	const sorted = [...notes].sort((a, b) => a.startSeconds - b.startSeconds);
	const result: Chord[] = [];

	for (const note of sorted) {
		const last = result[result.length - 1];
		if (last && note.startSeconds - last.startSeconds < CHORD_GROUP_TOLERANCE_SECONDS) {
			last.notes.push(note);
			if (!last.midis.includes(note.midi)) last.midis.push(note.midi);
		} else {
			result.push({
				startSeconds: note.startSeconds,
				midis: [note.midi],
				notes: [note],
			});
		}
	}
	return result;
}

export function chordIndexForTime(chords: Chord[], seconds: number): number {
	let lo = 0;
	let hi = chords.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (chords[mid].startSeconds < seconds) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}
