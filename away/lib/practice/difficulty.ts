import type { ParsedMidi } from "./midiParser";
import type { UploadDifficulty } from "./uploads";

const CHORD_WINDOW_SECONDS = 0.05;

export function estimateDifficulty(midi: ParsedMidi): UploadDifficulty {
	if (midi.notes.length === 0 || midi.durationSeconds <= 0) return "easy";

	const notesPerSecond = midi.notes.length / midi.durationSeconds;
	const maxSimultaneous = computeMaxSimultaneousNotes(midi);
	const bpm = midi.initialTempoBpm;

	let score = 0;

	if (notesPerSecond > 8) score += 3;
	else if (notesPerSecond > 5) score += 2;
	else if (notesPerSecond > 2.5) score += 1;

	if (maxSimultaneous >= 6) score += 3;
	else if (maxSimultaneous >= 4) score += 2;
	else if (maxSimultaneous >= 3) score += 1;

	if (bpm >= 160) score += 2;
	else if (bpm >= 120) score += 1;

	const range = computePitchRange(midi);
	if (range >= 48) score += 1;

	if (score >= 6) return "hard";
	if (score >= 3) return "medium";
	return "easy";
}

function computeMaxSimultaneousNotes(midi: ParsedMidi): number {
	let maxConcurrent = 0;
	const notes = midi.notes;
	for (let i = 0; i < notes.length; i++) {
		const start = notes[i].startSeconds;
		let concurrent = 0;
		for (let j = i; j < notes.length; j++) {
			const cur = notes[j];
			if (cur.startSeconds > start + CHORD_WINDOW_SECONDS) break;
			concurrent++;
		}
		if (concurrent > maxConcurrent) maxConcurrent = concurrent;
	}
	return maxConcurrent;
}

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
