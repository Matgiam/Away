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

export const C_DOM7 = [48, 52, 55, 58 ];

export const F_DOM7 = [41, 45, 48, 51];

export const G_DOM7 = [43, 47, 50, 53];

// C major scale across one octave starting at middle C
export const C_MAJOR_SCALE = [60, 62, 64, 65, 67, 69, 71, 72];
// G major scale starting at G3 (one octave) — has F♯
export const G_MAJOR_SCALE = [55, 57, 59, 60, 62, 64, 66, 67];
// F major scale starting at F3 (one octave) — has B♭
export const F_MAJOR_SCALE = [53, 55, 57, 58, 60, 62, 64, 65];
// D major scale starting at D3 (one octave) — has F♯ and C♯
export const D_MAJOR_SCALE = [50, 52, 54, 55, 57, 59, 61, 62];
// A natural minor scale starting at A3 (one octave) — all white keys
export const A_NATURAL_MINOR_SCALE = [57, 59, 60, 62, 64, 65, 67, 69];

// C major pentatonic (5 happy notes) — impossible to fail
export const C_MAJOR_PENTATONIC = [60, 62, 64, 67, 69, 72];
// A minor pentatonic (the rock/blues backbone)
export const A_MINOR_PENTATONIC = [57, 60, 62, 64, 67, 69];
// C blues scale (pentatonic + flat 5)
export const C_BLUES_SCALE = [60, 63, 65, 66, 67, 70, 72];

// 5-finger positions ("hand position 1") — same notes for both hands but different octaves
export const C_POSITION_RH = [60, 62, 64, 65, 67]; // RH thumb=C4 → pinky=G4
export const C_POSITION_LH = [48, 50, 52, 53, 55]; // LH pinky=C3 → thumb=G3
export const G_POSITION_RH = [67, 69, 71, 72, 74]; // RH thumb=G4 → pinky=D5

// Common chord shapes in additional octaves for hand-independence exercises
export const C_MAJOR_HIGH = [60, 64, 67]; // C4 E4 G4 (right-hand voicing)
export const F_MAJOR_HIGH = [65, 69, 72];
export const G_MAJOR_HIGH = [67, 71, 74];
export const A_MINOR_HIGH = [69, 72, 76];
// First-inversion C major (E3 G3 C4) — same chord, different lowest note
export const C_MAJOR_INV1 = [52, 55, 60];
// Second-inversion C major (G3 C4 E4)
export const C_MAJOR_INV2 = [55, 60, 64];

// C major 7th and Dominant 7 — for the "7th chord" lesson
export const C_MAJ7 = [48, 52, 55, 59]; // C E G B
export const G7 = [55, 59, 62, 65]; // G B D F

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
