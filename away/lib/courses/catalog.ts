import {
	A_MINOR,
	A_MINOR_HIGH,
	A_NATURAL_MINOR_SCALE,
	C_BLUES_SCALE,
	C_MAJ7,
	C_MAJOR,
	C_MAJOR_HIGH,
	C_MAJOR_INV1,
	C_MAJOR_INV2,
	C_MAJOR_PENTATONIC,
	C_MAJOR_SCALE,
	C_POSITION_LH,
	C_POSITION_RH,
	C_DOM7,
	F_DOM7,
	G_DOM7,
	D_MINOR,
	E_MINOR,
	F_MAJOR,
	F_MAJOR_HIGH,
	F_MAJOR_SCALE,
	G_MAJOR,
	G_MAJOR_HIGH,
	G_MAJOR_SCALE,
	G_POSITION_RH,
	G7,
	MIDDLE_C,
	midisOfLetterInRange,
	whiteKeysInRange,
} from "./music";
import type { Course } from "./types";

const ALL_CS = midisOfLetterInRange("C", 21, 108);
const ALL_DS = midisOfLetterInRange("D", 21, 108);
const ALL_ES = midisOfLetterInRange("E", 21, 108);
const ALL_FS = midisOfLetterInRange("F", 21, 108);
const ALL_GS = midisOfLetterInRange("G", 21, 108);
const ALL_AS = midisOfLetterInRange("A", 21, 108);
const ALL_BS = midisOfLetterInRange("B", 21, 108);

const C_SHARP_4 = 61;

const COURSES_LIST: Course[] = [
	// ── INTRO: Letter Notation ───────────────────────────────────────
	{
		id: "intro-letter-notation",
		category: "intro",
		title: "The Letter Notation",
		description: "Learn the 7 letters of music.",
		estimatedMinutes: 4,
		summary: [
			"Music uses just 7 letters: A B C D E F G",
			"How to find each letter using the black-key groups as landmarks",
			"Played all 7 notes in order from middle C",
		],
		steps: [
			{
				id: "1",
				type: "text",
				title: "7 letters, that's all",
				body: "Music uses just 7 letters: A B C D E F G. After G, we start over.",
			},
			{
				id: "2",
				type: "text",
				title: "Every white key has a name",
				body: "All the highlighted keys below are C. Each white key is one of the 7 letters.",
				highlightAccent: ALL_CS,
			},
			{
				id: "3",
				type: "play-any-of",
				title: "Press any C",
				body: "C is just before each group of 2 black keys.",
				highlightAccent: ALL_CS,
				allowedMidis: ALL_CS,
			},
			{
				id: "4",
				type: "play-any-of",
				title: "Press any D",
				body: "D sits between the 2 black keys.",
				highlightAccent: ALL_DS,
				allowedMidis: ALL_DS,
			},
			{
				id: "5",
				type: "play-any-of",
				title: "Press any E",
				body: "E is just after the 2 black keys.",
				highlightAccent: ALL_ES,
				allowedMidis: ALL_ES,
			},
			{
				id: "6",
				type: "play-any-of",
				title: "Press any F",
				body: "F is just before each group of 3 black keys.",
				highlightAccent: ALL_FS,
				allowedMidis: ALL_FS,
			},
			{
				id: "7",
				type: "play-any-of",
				title: "Press any G",
				body: "G sits between the first two black keys of the group of 3.",
				highlightAccent: ALL_GS,
				allowedMidis: ALL_GS,
			},
			{
				id: "8",
				type: "play-any-of",
				title: "Press any A",
				body: "A sits between the last two black keys of the group of 3.",
				highlightAccent: ALL_AS,
				allowedMidis: ALL_AS,
			},
			{
				id: "9",
				type: "play-any-of",
				title: "Press any B",
				body: "B is the last white key before C comes back.",
				highlightAccent: ALL_BS,
				allowedMidis: ALL_BS,
			},
			{
				id: "10",
				type: "play-sequence",
				title: "Play C to C",
				body: "From middle C, play all 7 letters in order, then back to C.",
				sequence: C_MAJOR_SCALE,
				sequenceLabels: ["C", "D", "E", "F", "G", "A", "B", "C"],
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "11",
				type: "text",
				title: "Nice!",
				body: "You can now name every white key. That's the whole alphabet of music.",
			},
		],
	},

	// ── INTRO: Piano Keys ────────────────────────────────────────────
	{
		id: "intro-piano-keys",
		category: "intro",
		title: "The Piano Keys",
		description: "88 keys, repeated patterns, and middle C.",
		estimatedMinutes: 3,
		summary: [
			"88 keys total: 52 white and 36 black",
			"The 2+3 black-key pattern repeats every octave",
			"Found and played middle C",
			"Black keys are sharps (♯) and flats (♭)",
		],
		steps: [
			{
				id: "1",
				type: "text",
				title: "88 keys",
				body: "52 white, 36 black. The pattern of 2 + 3 black keys repeats over and over.",
			},
			{
				id: "2",
				type: "text",
				title: "Octaves",
				body: "Each repeat of the pattern is one octave. The same letter shows up every octave.",
				highlightAccent: ALL_CS,
			},
			{
				id: "3",
				type: "text",
				title: "Middle C",
				body: "The C in the middle of the piano. Your starting point.",
				highlightKeys: [MIDDLE_C],
			},
			{
				id: "4",
				type: "play-note",
				title: "Press middle C",
				body: "The highlighted key.",
				midi: MIDDLE_C,
				highlightKeys: [MIDDLE_C],
			},
			{
				id: "5",
				type: "text",
				title: "Black keys = sharps and flats",
				body: "The black key right of C is C♯ (also called D♭).",
				highlightAccent: [C_SHARP_4],
			},
			{
				id: "6",
				type: "play-note",
				title: "Press C♯",
				body: "The black key just right of middle C.",
				midi: C_SHARP_4,
				highlightKeys: [C_SHARP_4],
			},
			{
				id: "7",
				type: "play-sequence",
				title: "C in three octaves",
				body: "Low C → middle C → high C.",
				sequence: [48, 60, 72],
				sequenceLabels: ["C3", "C4", "C5"],
				highlightKeys: [48, 60, 72],
			},
		],
	},
];

export function getAllCourses(): Course[] {
	return COURSES_LIST;
}

export function getCourseById(id: string): Course | undefined {
	return COURSES_LIST.find((c) => c.id === id);
}
