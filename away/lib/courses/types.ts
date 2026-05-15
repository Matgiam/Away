export type CourseCategoryKey =
	| "intro"
	| "scales"
	| "hand_independence"
	| "chords"
	| "intervals"
	| "improvisation";

export type CourseCategory = {
	key: CourseCategoryKey;
	label: string;
};

export const COURSE_CATEGORIES: CourseCategory[] = [
	{ key: "intro", label: "Intro" },
	{ key: "scales", label: "Scales" },
	{ key: "hand_independence", label: "Hand independance" },
	{ key: "chords", label: "Chords" },
	{ key: "intervals", label: "Intervals" },
	{ key: "improvisation", label: "Improvisation" },
];

// A "lane" is a falling-note column shown on screen.
export type LaneNote = {
	midi: number;
	startSeconds: number;
	durationSeconds: number;
	velocity?: number;
	hand?: "right" | "left";
};

// Different types of interactive steps inside a course
export type CourseStep =
	| TextStep
	| PlayNoteStep
	| PlayAnyOfStep
	| PlayChordStep
	| PlaySequenceStep
	| DemoSequenceStep
	| ImprovisationStep;

interface BaseStep {
	id: string;
	title?: string;
	body: string;
	// MIDIs to highlight on the piano while this step is active
	highlightKeys?: number[];
	// Optional secondary highlights (used to show "all C notes" etc.)
	highlightAccent?: number[];
	// Auto-played demonstration shown before the user is asked to play.
	// Each element is a single midi (a note) or an array of midis (a chord played together).
	// If omitted on an interactive step, the app derives the demo from the step itself
	// (eg. play-chord auto-demos the chord, play-sequence auto-demos the sequence).
	demoNotes?: Array<number | number[]>;
	// Override per-note demo duration (ms). Default 600 for single notes, 1100 for chords.
	demoNoteDurationMs?: number;
	// Override the gap between demo notes (ms). Default 200.
	demoGapMs?: number;
	// Skip the auto-demo even though one could be derived.
	skipAutoDemo?: boolean;
}

// Just text + optional key highlights
export interface TextStep extends BaseStep {
	type: "text";
}

// User must play a specific midi (exact octave required)
export interface PlayNoteStep extends BaseStep {
	type: "play-note";
	midi: number;
	// If true, falling note will repeat until played
	persistent?: boolean;
}

// User can play any midi from a list (eg. any C anywhere on the keyboard)
export interface PlayAnyOfStep extends BaseStep {
	type: "play-any-of";
	allowedMidis: number[];
	// How many distinct hits needed (default 1)
	hitsNeeded?: number;
}

// User must play all midis simultaneously (chord gate, same as practice mode auto-pause)
export interface PlayChordStep extends BaseStep {
	type: "play-chord";
	midis: number[];
	chordName?: string;
}

// User plays a sequence of notes in order
export interface PlaySequenceStep extends BaseStep {
	type: "play-sequence";
	// Each element is either a single midi (one note) or an array of midis (chord)
	sequence: Array<number | number[]>;
	// Friendly labels for each step in the sequence (shown above the keyboard)
	sequenceLabels?: string[];
}

// App auto-plays a sequence for demonstration. User can replay or move on.
export interface DemoSequenceStep extends BaseStep {
	type: "demo-sequence";
	// Notes with timing
	notes: LaneNote[];
	bpm?: number;
	// Total duration of the demo (used for auto-stop if no notes provided)
	durationSeconds: number;
	autoPlayOnEnter?: boolean;
}

// Improvisation step: backing chords loop, user plays freely over a scale
export interface ImprovisationStep extends BaseStep {
	type: "improvisation";
	bpm: number;
	beatsPerChord: number;
	chords: Array<{
		name: string;
		midis: number[];
	}>;
	scaleMidis: number[];
	// How many loops before the exercise ends; null = endless until user clicks Next
	loopCount: number | null;
}

export type Course = {
	id: string;
	category: CourseCategoryKey;
	title: string;
	description: string;
	estimatedMinutes: number;
	steps: CourseStep[];
};
