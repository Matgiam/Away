import type { ParsedMidi, ParsedNote } from "./midiParser";

export type Hand = "right" | "left";

export type HandAssignment = (note: ParsedNote) => Hand;

const MIDDLE_C = 60;

export function buildHandAssignment(midi: ParsedMidi): HandAssignment {
	const trackAverages = new Map<number, { sum: number; count: number }>();
	for (const note of midi.notes) {
		const entry = trackAverages.get(note.track) ?? { sum: 0, count: 0 };
		entry.sum += note.midi;
		entry.count += 1;
		trackAverages.set(note.track, entry);
	}

	const activeTracks = Array.from(trackAverages.entries())
		.filter(([, v]) => v.count > 0)
		.map(([track, v]) => ({ track, avg: v.sum / v.count }))
		.sort((a, b) => b.avg - a.avg);

	if (activeTracks.length >= 2) {
		const trackHands = new Map<number, Hand>();
		for (let i = 0; i < activeTracks.length; i++) {
			trackHands.set(activeTracks[i].track, i === 0 ? "right" : "left");
		}
		return (note) => trackHands.get(note.track) ?? (note.midi >= MIDDLE_C ? "right" : "left");
	}

	return (note) => (note.midi >= MIDDLE_C ? "right" : "left");
}
