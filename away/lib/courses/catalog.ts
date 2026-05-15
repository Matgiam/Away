import {
	A_MINOR,
	C_MAJOR,
	C_MAJOR_SCALE,
	F_MAJOR,
	G_MAJOR,
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

// C#4 (between C4 and D4)
const C_SHARP_4 = 61;

const COURSES_LIST: Course[] = [
	// ── COURSE 1 — INTRO ──────────────────────────────────────────────
	{
		id: "intro-letter-notation",
		category: "intro",
		title: "The Letter Notation",
		description: "Learn the 7 letters that make up all of Western music.",
		estimatedMinutes: 4,
		steps: [
			{
				id: "1",
				type: "text",
				title: "Music has only 7 letters",
				body: "Western music is built from just seven note names: A · B · C · D · E · F · G. After G we go back to A and the cycle continues. That's it — every note you'll ever play is one of these seven.",
			},
			{
				id: "2",
				type: "text",
				title: "The white keys",
				body: "Look at the piano below. Every white key is named after one of the seven letters. The black keys are 'sharps' and 'flats' — we'll get to those later. We are looking at all of the C notes on the keyboard.",
				highlightAccent: ALL_CS,
			},
			{
				id: "3",
				type: "play-any-of",
				title: "Find a C",
				body: "C is the white key just to the left of every group of two black keys. Press any C on the keyboard to continue.",
				highlightAccent: ALL_CS,
				allowedMidis: ALL_CS,
			},
			{
				id: "4",
				type: "play-any-of",
				title: "Now D",
				body: "D sits between the two black keys. Press any D to continue.",
				highlightAccent: ALL_DS,
				allowedMidis: ALL_DS,
			},
			{
				id: "5",
				type: "play-any-of",
				title: "Now E",
				body: "E is just to the right of the second black key in the group of two. Press any E.",
				highlightAccent: ALL_ES,
				allowedMidis: ALL_ES,
			},
			{
				id: "6",
				type: "play-any-of",
				title: "F",
				body: "F is just to the left of every group of three black keys.",
				highlightAccent: ALL_FS,
				allowedMidis: ALL_FS,
			},
			{
				id: "7",
				type: "play-any-of",
				title: "G",
				body: "G is between the first and second black keys of the group of three.",
				highlightAccent: ALL_GS,
				allowedMidis: ALL_GS,
			},
			{
				id: "8",
				type: "play-any-of",
				title: "A",
				body: "A is between the second and third black keys of the group of three.",
				highlightAccent: ALL_AS,
				allowedMidis: ALL_AS,
			},
			{
				id: "9",
				type: "play-any-of",
				title: "B",
				body: "B is the very last white key before we wrap around to C again.",
				highlightAccent: ALL_BS,
				allowedMidis: ALL_BS,
			},
			{
				id: "10",
				type: "play-sequence",
				title: "Play the alphabet",
				body: "Now play the seven letters in order, starting on middle C: C · D · E · F · G · A · B · C.",
				sequence: C_MAJOR_SCALE,
				sequenceLabels: ["C", "D", "E", "F", "G", "A", "B", "C"],
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "11",
				type: "text",
				title: "You know the letters!",
				body: "From here on, every note we talk about will be one of A, B, C, D, E, F or G. Whenever you see a key on the piano, you can name it. Press Next to finish the lesson.",
			},
		],
	},

	// ── COURSE 2 — INTRO ──────────────────────────────────────────────
	{
		id: "intro-piano-keys",
		category: "intro",
		title: "The Piano Keys",
		description: "Understand the layout: white keys, black keys, octaves and middle C.",
		estimatedMinutes: 4,
		steps: [
			{
				id: "1",
				type: "text",
				title: "88 keys",
				body: "A full piano has 88 keys: 52 white keys and 36 black keys. The pattern of two black keys then three black keys repeats over and over. Those groups are your landmarks.",
			},
			{
				id: "2",
				type: "text",
				title: "Octaves",
				body: "Each repeat of the pattern is one octave. So the piano contains a little over seven octaves. The same letter (say, C) appears once per octave — same name, different pitch.",
				highlightAccent: ALL_CS,
			},
			{
				id: "3",
				type: "text",
				title: "Middle C",
				body: "Middle C is the C closest to the middle of the keyboard. We highlight it below. Most beginner songs live around middle C, so it's a good 'home base'.",
				highlightKeys: [MIDDLE_C],
				highlightAccent: ALL_CS,
			},
			{
				id: "4",
				type: "play-note",
				title: "Play middle C",
				body: "Press the highlighted key — that's middle C, right at the middle of the keyboard.",
				midi: MIDDLE_C,
				highlightKeys: [MIDDLE_C],
			},
			{
				id: "5",
				type: "text",
				title: "Black keys",
				body: "The black keys are sharps (♯) and flats (♭). The black key just to the right of C is called C-sharp (C♯) — and it's also called D-flat (D♭) because it's just to the left of D.",
				highlightAccent: [C_SHARP_4],
			},
			{
				id: "6",
				type: "play-note",
				title: "Play C♯",
				body: "Press the C♯ next to middle C (the first black key after middle C).",
				midi: C_SHARP_4,
				highlightKeys: [C_SHARP_4],
			},
			{
				id: "7",
				type: "play-sequence",
				title: "Three octaves of C",
				body: "Now jump octaves. Play C in three different octaves: low C (C3) → middle C (C4) → high C (C5).",
				sequence: [48, 60, 72],
				sequenceLabels: ["C3", "C4", "C5"],
				highlightKeys: [48, 60, 72],
			},
			{
				id: "8",
				type: "text",
				title: "You've got the map!",
				body: "You can now find any white key by its name, locate middle C, and tell a sharp from a flat. The keyboard is no longer a wall of keys — it's a pattern.",
			},
		],
	},

	// ── COURSE 3 — CHORDS ──────────────────────────────────────────────
	{
		id: "chords-what-is-a-chord",
		category: "chords",
		title: "What is a Chord",
		description: "Build your first chords: C major, F, G and A minor.",
		estimatedMinutes: 6,
		steps: [
			{
				id: "1",
				type: "text",
				title: "Two or more notes",
				body: "A chord is two or more notes played at the same time. The most common chord is the triad — three notes stacked on top of each other.",
			},
			{
				id: "2",
				type: "text",
				title: "The C major chord",
				body: "We build a C major chord by stacking C, E and G — every other white key starting from C. Take a look at the three notes lit up on the keyboard.",
				highlightKeys: C_MAJOR,
			},
			{
				id: "3",
				type: "play-chord",
				title: "Play C major",
				body: "Now press C, E and G together. The notes will start falling — release when you've held all three.",
				midis: C_MAJOR,
				chordName: "C",
				highlightKeys: C_MAJOR,
			},
			{
				id: "4",
				type: "text",
				title: "Major sounds happy",
				body: "That bright, open sound is a major chord. Let's try another one — F major: F, A and C. Same recipe (root + every other white key).",
				highlightKeys: F_MAJOR,
			},
			{
				id: "5",
				type: "play-chord",
				title: "Play F major",
				body: "Press F, A and C together. Look for the F just below middle C.",
				midis: F_MAJOR,
				chordName: "F",
				highlightKeys: F_MAJOR,
			},
			{
				id: "6",
				type: "play-chord",
				title: "Play G major",
				body: "Now G major: G, B and D. Same idea, starting on G.",
				midis: G_MAJOR,
				chordName: "G",
				highlightKeys: G_MAJOR,
			},
			{
				id: "7",
				type: "text",
				title: "Meet minor",
				body: "If we start on A and stack every other white key, we get A · C · E. That's A minor — and it sounds sad. Major and minor chords use the exact same pattern of every-other-white-key — they just start on different notes.",
				highlightKeys: A_MINOR,
			},
			{
				id: "8",
				type: "play-chord",
				title: "Play A minor",
				body: "Press A, C and E together. Listen to the difference — it sounds darker than C major.",
				midis: A_MINOR,
				chordName: "Am",
				highlightKeys: A_MINOR,
			},
			{
				id: "9",
				type: "play-sequence",
				title: "The four magic chords",
				body: "Play these in order: C → A minor → F → G. You just played the chord progression behind thousands of pop songs.",
				sequence: [C_MAJOR, A_MINOR, F_MAJOR, G_MAJOR],
				sequenceLabels: ["C", "Am", "F", "G"],
			},
			{
				id: "10",
				type: "text",
				title: "Chords unlocked",
				body: "You now know four chords — that's enough to accompany hundreds of songs. The next course shows you how to actually play over these chords.",
			},
		],
	},

	// ── COURSE 4 — INTERVALS & SCALES ─────────────────────────────────
	{
		id: "intervals-c-major-scale",
		category: "intervals",
		title: "Intervals & the C Major Scale",
		description: "Half steps, whole steps, and your first scale.",
		estimatedMinutes: 6,
		steps: [
			{
				id: "1",
				type: "text",
				title: "What is an interval?",
				body: "An interval is the distance between two notes. The smallest interval on the piano is the half step — moving from one key to the very next key, black or white.",
			},
			{
				id: "2",
				type: "play-sequence",
				title: "A half step",
				body: "Play C, then C♯ (the black key just to the right). That's one half step up.",
				sequence: [MIDDLE_C, C_SHARP_4],
				sequenceLabels: ["C", "C♯"],
				highlightKeys: [MIDDLE_C, C_SHARP_4],
			},
			{
				id: "3",
				type: "play-sequence",
				title: "A whole step",
				body: "Two half steps make a whole step. Play C, then D — skipping the black key in between.",
				sequence: [MIDDLE_C, 62],
				sequenceLabels: ["C", "D"],
				highlightKeys: [MIDDLE_C, 62],
			},
			{
				id: "4",
				type: "text",
				title: "Scales are recipes",
				body: "A scale is a pattern of half and whole steps that creates a 'flavour'. The major scale recipe is: W · W · H · W · W · W · H (W = whole step, H = half step).",
			},
			{
				id: "5",
				type: "text",
				title: "Apply the recipe from C",
				body: "Start on C. Whole step → D. Whole step → E. Half step → F. Whole step → G. Whole step → A. Whole step → B. Half step → C. We never touch a black key — that's the C major scale.",
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "6",
				type: "play-sequence",
				title: "Play the scale up",
				body: "Play C · D · E · F · G · A · B · C — one note at a time.",
				sequence: C_MAJOR_SCALE,
				sequenceLabels: ["C", "D", "E", "F", "G", "A", "B", "C"],
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "7",
				type: "play-sequence",
				title: "Play the scale down",
				body: "Now play it back down: C · B · A · G · F · E · D · C.",
				sequence: [72, 71, 69, 67, 65, 64, 62, 60],
				sequenceLabels: ["C", "B", "A", "G", "F", "E", "D", "C"],
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "8",
				type: "text",
				title: "You know a scale!",
				body: "The C major scale is your toolkit for the final course — improvisation. Any of these seven notes will sound 'in the key' over a C-major chord progression.",
				highlightKeys: C_MAJOR_SCALE,
			},
		],
	},

	// ── COURSE 5 — IMPROVISATION ──────────────────────────────────────
	{
		id: "improvisation-in-c-major",
		category: "improvisation",
		title: "Improvising in C Major (Do)",
		description: "Make up melodies over a looping C – Am – F – G backing track.",
		estimatedMinutes: 8,
		steps: [
			{
				id: "1",
				type: "text",
				title: "Improvisation = no wrong notes",
				body: "Improvisation means making music up on the spot. If you stay inside the right scale, anything you play will fit. We'll use the C major scale, which is just the white keys.",
			},
			{
				id: "2",
				type: "text",
				title: "Your toolbox",
				body: "Below: every white key from middle C up an octave. Those are the seven notes that 'work' over our backing track. Try a few — none of them are wrong.",
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "3",
				type: "play-any-of",
				title: "Try the scale freely",
				body: "Listen to the scale, then press any 8 white keys in any order. Hear how they all sound 'fine' in C major.",
				allowedMidis: whiteKeysInRange(60, 84),
				hitsNeeded: 8,
				highlightKeys: C_MAJOR_SCALE,
				demoNotes: C_MAJOR_SCALE,
				demoNoteDurationMs: 400,
				demoGapMs: 120,
			},
			{
				id: "4",
				type: "text",
				title: "The backing track",
				body: "We'll loop the chord progression C → Am → F → G — one of the most popular progressions in pop music. Each chord lasts for 4 beats at 80 BPM.",
			},
			{
				id: "5",
				type: "text",
				title: "Tips before you start",
				body: "• Start slow — leave space between notes.\n• End your phrases on C, E or G — they sound like 'home'.\n• Repeat ideas. Repetition makes melodies memorable.\n• If you hit a 'wrong' note, just step up or down to the next white key.",
				highlightKeys: C_MAJOR_SCALE,
			},
			{
				id: "6",
				type: "improvisation",
				title: "Improvise over C – Am – F – G",
				body: "The chords are looping. Play any white keys above middle C — there are no wrong notes. The chord name appears as it changes. Take your time and have fun.",
				bpm: 180,
				beatsPerChord: 4,
				chords: [
					{ name: "C", midis: C_MAJOR },
					{ name: "Am", midis: A_MINOR },
					{ name: "F", midis: F_MAJOR },
					{ name: "G", midis: G_MAJOR },
				],
				scaleMidis: whiteKeysInRange(60, 108),
				loopCount: null,
				highlightKeys: whiteKeysInRange(60, 108),
			},
			{
				id: "7",
				type: "text",
				title: "You've improvised!",
				body: "You just played music nobody had ever played before. That's improvisation. Come back any time and the backing track will be waiting for you.",
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
