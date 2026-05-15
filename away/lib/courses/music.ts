export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export function midiToName(midi: number): string {
	const name = NOTE_NAMES[midi % 12];
	const oct = Math.floor(midi / 12) - 1;
	return `${name}${oct}`;
}

export function midiToLetter(midi: number): string {
	return NOTE_NAMES[midi % 12];
}

export function isBlackKey(midi: number): boolean {
	return NOTE_NAMES[midi % 12].includes("#");
}

export function noteNameToMidi(name: string): number {
	const match = name.match(/^([A-G])([#b])?(-?\d+)$/);
	if (!match) throw new Error(`Invalid note name: ${name}`);
	const [, letter, accidental, octStr] = match;
	const baseMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
	let semitone = baseMap[letter];
	if (accidental === "#") semitone++;
	if (accidental === "b") semitone--;
	const oct = parseInt(octStr, 10);
	return semitone + (oct + 1) * 12;
}

// Standard middle-octave references
export const MIDDLE_C = 60;


export const C_MAJOR = [48, 52, 55];
// F major (F3 A3 C4)
export const F_MAJOR = [48, 53, 57];
// G major (G3 B3 D4)
export const G_MAJOR = [50, 55, 59];
// A minor (A3 C4 E4)
export const A_MINOR = [45, 48, 52];
// D minor (D3 F3 A3)
export const D_MINOR = [50, 53, 57];
// E minor (E3 G3 B3)
export const E_MINOR = [52, 55, 59];

// C major scale across one octave starting at middle C
export const C_MAJOR_SCALE = [60, 62, 64, 65, 67, 69, 71, 72];

// All white-key MIDIs across an octave range, used for "C major scale" looser definition
export function whiteKeysInRange(low: number, high: number): number[] {
	const out: number[] = [];
	for (let m = low; m <= high; m++) {
		if (!isBlackKey(m)) out.push(m);
	}
	return out;
}

// Pitch class of "C" notes in a range (so we can highlight every C)
export function midisOfLetterInRange(letter: string, low: number, high: number): number[] {
	const baseMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
	const pc = baseMap[letter.toUpperCase()];
	if (pc === undefined) return [];
	const out: number[] = [];
	for (let m = low; m <= high; m++) {
		if (m % 12 === pc) out.push(m);
	}
	return out;
}

export function pitchClass(midi: number): number {
	return ((midi % 12) + 12) % 12;
}

// Used by the gate logic when the course wants a chord regardless of octave
export function chordContainsByPitchClass(target: number[], midi: number): boolean {
	const tps = new Set(target.map(pitchClass));
	return tps.has(pitchClass(midi));
}
