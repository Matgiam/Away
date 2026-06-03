// ============================================================================
// courses/types.ts
// ----------------------------------------------------------------------------
// Shapes for the structured-course system (the "Practice → Courses" tab).
//
// A `Course` is a sequence of `CourseStep`s the user works through. Each step
// is one of several discriminated-union types — text, play-note, play-chord,
// sequence, demo-sequence, improvisation, ear-training — and the player UI
// in `components/courses/` dispatches on `step.type` to render the right
// interactive surface.
//
// This file contains no runtime logic, only the type system + the category
// constants used by the course menu.
// ============================================================================

// Top-level course categories shown in the course menu.
// Keep this list in sync with COURSE_CATEGORIES below — the strings are used
// as keys in the per-category course list.
export type CourseCategoryKey =
	| "intro"
	| "scales"
	| "hand_independence"
	| "chords"
	| "intervals"
	| "ear_training"
	| "improvisation";

export type CourseCategory = {
	key: CourseCategoryKey;
	label: string;
};

// Display order for the menu. `label` is what the user sees on the cards.
export const COURSE_CATEGORIES: CourseCategory[] = [
	{ key: "intro", label: "Intro" },
	{ key: "scales", label: "Scales" },
	{ key: "hand_independence", label: "Hand independance" },
	{ key: "chords", label: "Chords" },
	{ key: "intervals", label: "Intervals" },
	{ key: "ear_training", label: "Ear training" },
	{ key: "improvisation", label: "Improvisation" },
];

// A "lane" is a falling-note column shown on screen.
// Used by demo-sequence and improvisation steps to define what falls.
export type LaneNote = {
	midi: number;
	startSeconds: number;
	durationSeconds: number;
	velocity?: number;
	hand?: "right" | "left"; // colours / lanes the visualizer uses for hand independence
};

// Different types of interactive steps inside a course
// Discriminated union — every step is one of these. The player picks the
// right component by switching on `step.type`.
export type CourseStep =
	| TextStep
	| PlayNoteStep
	| PlayAnyOfStep
	| PlayChordStep
	| PlaySequenceStep
	| DemoSequenceStep
	| ImprovisationStep
	| EarTrainingStep;

// Fields every step shares. The optional fields here drive the auto-demo
// system, the metronome auto-toggle, and the diagram/illustration system.
interface BaseStep {
	id: string;
	title?: string;
	body: string;
	// Optional illustration to render inside the step card (path relative to /public).
	// Use for diagrams that make the concept concrete: keyboard layouts, chord shapes,
	// finger numbers, posture, etc. Skip on highly interactive steps where the falling-note
	// lane already conveys the action.
	image?: string;
	// Short alt text for the image (also shown under the image as a caption).
	imageAlt?: string;
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
	// Suggested tempo for this step. If set, the metronome auto-turns on at this BPM
	// when the user enters the step (they can still toggle it off in the navigation).
	bpm?: number;
	// Beats per bar for the auto-on metronome. Default 4.
	beatsPerBar?: number;
}

// Just text + optional key highlights
// Static lesson card with no input required — user clicks "Next" to advance.
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
// Octave-agnostic version of PlayNoteStep — used for "find all the C notes" etc.
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
// Sequence elements can be single notes OR chords (sub-arrays).
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

// Ear-training step: app plays audio (nothing highlighted on the keyboard) and the user
// picks the right answer from a small list of choices. Used for "is the second note higher
// or lower", "major or minor", "octave or 5th", etc.
export interface EarTrainingStep extends BaseStep {
	type: "ear-training";
	// The pitches to play. Sequential when isChord is false, simultaneous when true.
	notes: number[];
	isChord?: boolean;
	// Per-note duration in milliseconds (sequential mode). Default 700.
	noteDurationMs?: number;
	// Gap between sequential notes in milliseconds. Default 150.
	gapMs?: number;
	// Hold time for chord mode in milliseconds. Default 1500.
	chordHoldMs?: number;
	// Multiple-choice answers shown to the user.
	options: Array<{ id: string; label: string }>;
	// The id of the option that completes the step.
	correctOptionId: string;
}

// Improvisation step: backing chords loop, user plays freely over a scale
// The backing track loops `chords` at the given BPM; user freedom is bounded
// only by which `scaleMidis` are highlighted as "safe" notes to play.
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

// Top-level course shape — the catalog in `catalog.ts` is an array of these.
export type Course = {
	id: string;
	category: CourseCategoryKey;
	title: string;
	description: string;
	estimatedMinutes: number;
	steps: CourseStep[];
	// Bullet points shown on the "Course complete" finish screen. If omitted, the player
	// auto-derives a summary from the step titles.
	summary?: string[];
};
