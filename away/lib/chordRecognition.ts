// ============================================================================
// chordRecognition.ts
// ----------------------------------------------------------------------------
// Identifies the most likely chord name for a set of currently-held MIDI notes.
//
// The algorithm in `recognizeChord` runs three passes, in priority order:
//   1. EXACT match           — the interval set matches a known pattern exactly.
//   2. SUBSET / "add" match  — held notes contain a known pattern plus extras
//                              (e.g. C major triad + 9 → Cadd9).
//   3. SUPERSET / "omit" match — held notes are a subset of a larger known
//                              pattern with 1–2 chord-defining tones missing
//                              (e.g. C–E–Bb → C7 omit5).
//
// Tie-breakers favour:
//   * Higher-priority patterns (defined per entry in CHORD_PATTERNS).
//   * Roots whose pitch class also happens to be the bass note (-> non-inversion).
//
// When no pattern fits at all, the function returns the literal note names so
// the chord display always has *something* useful to show.
//
// Inputs are MIDI numbers; outputs use sharp note names ("F#", not "Gb") to
// keep the surface small.
// ============================================================================

const SHARP_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

// Public chord description. `label` is the pretty string to display; the
// other fields let the caller render variations (e.g. colour the root in the
// chord display, hide the slash bass when it equals the root).
export type RecognizedChord = {
	label: string;             // e.g. "Cmaj7", "F#m7/A"
	rootName: string | null;   // null for unlabelled chords (e.g. "C E G#" with no fit)
	quality: string | null;    // e.g. "maj7", "m" — empty string "" for plain major
	bassName: string | null;   // null when bass == root
	inversion: boolean;        // true when bass != root
	noteCount: number;
};

// One chord pattern entry: the intervals (in semitones from the root) that
// define the chord, the symbol that follows the root name, and a priority
// used to break ties between competing matches.
type ChordPattern = {
	intervals: number[];
	symbol: string;
	priority: number;
};

// Patterns grouped by note count, then roughly by complexity within each
// group. Priority numbers favour:
//   * Larger / more specific chords (more notes locks in more info → higher).
//   * Common shapes (plain major/minor) over esoteric ones.
const CHORD_PATTERNS: ChordPattern[] = [
	// 2-note
	{ intervals: [0, 7], symbol: "5", priority: 60 },

	// Triads (3-note)
	{ intervals: [0, 4, 7], symbol: "", priority: 100 },
	{ intervals: [0, 3, 7], symbol: "m", priority: 100 },
	{ intervals: [0, 3, 6], symbol: "dim", priority: 95 },
	{ intervals: [0, 4, 8], symbol: "aug", priority: 95 },
	{ intervals: [0, 2, 7], symbol: "sus2", priority: 90 },
	{ intervals: [0, 5, 7], symbol: "sus4", priority: 90 },

	// 4-note (7ths, 6ths, adds, alt. dominants)
	{ intervals: [0, 4, 7, 11], symbol: "maj7", priority: 120 },
	{ intervals: [0, 3, 7, 10], symbol: "m7", priority: 120 },
	{ intervals: [0, 4, 7, 10], symbol: "7", priority: 120 },
	{ intervals: [0, 3, 6, 9], symbol: "dim7", priority: 118 },
	{ intervals: [0, 3, 6, 10], symbol: "m7b5", priority: 117 },
	{ intervals: [0, 3, 7, 11], symbol: "mMaj7", priority: 116 },
	{ intervals: [0, 3, 6, 11], symbol: "dimMaj7", priority: 114 },
	{ intervals: [0, 4, 7, 9], symbol: "6", priority: 110 },
	{ intervals: [0, 3, 7, 9], symbol: "m6", priority: 110 },
	{ intervals: [0, 5, 7, 10], symbol: "7sus4", priority: 108 },
	{ intervals: [0, 2, 7, 10], symbol: "7sus2", priority: 105 },
	{ intervals: [0, 5, 7, 11], symbol: "maj7sus4", priority: 105 },
	{ intervals: [0, 2, 7, 11], symbol: "maj7sus2", priority: 102 },
	{ intervals: [0, 2, 4, 7], symbol: "add9", priority: 95 },
	{ intervals: [0, 2, 3, 7], symbol: "madd9", priority: 95 },
	{ intervals: [0, 4, 5, 7], symbol: "add11", priority: 90 },
	{ intervals: [0, 3, 5, 7], symbol: "madd11", priority: 90 },
	{ intervals: [0, 4, 8, 10], symbol: "7#5", priority: 115 },
	{ intervals: [0, 4, 6, 10], symbol: "7b5", priority: 115 },
	{ intervals: [0, 4, 6, 11], symbol: "maj7b5", priority: 112 },
	{ intervals: [0, 4, 8, 11], symbol: "maj7#5", priority: 112 },

	// 5-note (9ths, altered dominants, 7th + tensions)
	{ intervals: [0, 2, 4, 7, 10], symbol: "9", priority: 130 },
	{ intervals: [0, 2, 4, 7, 11], symbol: "maj9", priority: 130 },
	{ intervals: [0, 2, 3, 7, 10], symbol: "m9", priority: 130 },
	{ intervals: [0, 2, 3, 7, 11], symbol: "mMaj9", priority: 128 },
	{ intervals: [0, 2, 4, 7, 9], symbol: "6/9", priority: 128 },
	{ intervals: [0, 2, 3, 7, 9], symbol: "m6/9", priority: 126 },
	{ intervals: [0, 1, 4, 7, 10], symbol: "7b9", priority: 125 },
	{ intervals: [0, 3, 4, 7, 10], symbol: "7#9", priority: 125 },
	{ intervals: [0, 4, 5, 7, 10], symbol: "7add11", priority: 122 },
	{ intervals: [0, 4, 5, 7, 11], symbol: "maj7add11", priority: 121 },
	{ intervals: [0, 4, 7, 9, 11], symbol: "maj7add6", priority: 121 },
	{ intervals: [0, 3, 5, 7, 10], symbol: "m11no9", priority: 120 },
	{ intervals: [0, 4, 7, 9, 10], symbol: "13no9", priority: 122 },
	{ intervals: [0, 4, 6, 7, 10], symbol: "7#11", priority: 124 },
	{ intervals: [0, 4, 6, 7, 11], symbol: "maj7#11", priority: 124 },
	{ intervals: [0, 4, 7, 8, 10], symbol: "7b13", priority: 122 },
	{ intervals: [0, 2, 4, 6, 10], symbol: "9b5", priority: 124 },
	{ intervals: [0, 2, 4, 8, 10], symbol: "9#5", priority: 124 },
	{ intervals: [0, 1, 3, 4, 10], symbol: "7b9#9", priority: 118 },
	{ intervals: [0, 2, 3, 6, 10], symbol: "m9b5", priority: 120 },
	{ intervals: [0, 2, 5, 7, 10], symbol: "9sus4", priority: 120 },
	{ intervals: [0, 1, 5, 7, 10], symbol: "7sus4b9", priority: 115 },

	// 6-note (11ths, 13ths, dense tensions)
	{ intervals: [0, 2, 4, 5, 7, 10], symbol: "11", priority: 140 },
	{ intervals: [0, 2, 3, 5, 7, 10], symbol: "m11", priority: 140 },
	{ intervals: [0, 2, 4, 5, 7, 11], symbol: "maj11", priority: 140 },
	{ intervals: [0, 2, 4, 7, 9, 10], symbol: "13", priority: 145 },
	{ intervals: [0, 2, 3, 7, 9, 10], symbol: "m13", priority: 145 },
	{ intervals: [0, 2, 4, 7, 9, 11], symbol: "maj13", priority: 143 },
	{ intervals: [0, 2, 5, 7, 9, 10], symbol: "13sus", priority: 138 },
	{ intervals: [0, 2, 3, 5, 6, 10], symbol: "m11b5", priority: 134 },
	{ intervals: [0, 2, 3, 6, 9], symbol: "dim9", priority: 124 },
	{ intervals: [0, 2, 4, 6, 7, 10], symbol: "9#11", priority: 142 },
	{ intervals: [0, 2, 4, 6, 7, 11], symbol: "maj9#11", priority: 142 },
	{ intervals: [0, 2, 3, 6, 7, 10], symbol: "m9#11", priority: 138 },
	{ intervals: [0, 1, 4, 7, 9, 10], symbol: "13b9", priority: 138 },
	{ intervals: [0, 3, 4, 7, 9, 10], symbol: "13#9", priority: 138 },
	{ intervals: [0, 2, 4, 6, 9, 10], symbol: "13b5", priority: 136 },
	{ intervals: [0, 2, 4, 7, 8, 10], symbol: "9b13", priority: 134 },
	{ intervals: [0, 1, 4, 7, 8, 10], symbol: "7b9b13", priority: 132 },
	{ intervals: [0, 1, 4, 6, 7, 10], symbol: "7b9#11", priority: 130 },
	{ intervals: [0, 3, 4, 6, 7, 10], symbol: "7#9#11", priority: 130 },

	// 7-note (full extended chords)
	{ intervals: [0, 2, 4, 6, 7, 9, 10], symbol: "13#11", priority: 150 },
	{ intervals: [0, 2, 4, 6, 7, 9, 11], symbol: "maj13#11", priority: 150 },
	{ intervals: [0, 2, 3, 5, 7, 9, 10], symbol: "m13add11", priority: 148 },
];

// Re-express pitch classes as intervals from a chosen root, sorted ascending.
// `(pc - rootPc + 12) % 12` handles wraparound so "C and G" relative to G
// becomes [0, 5] rather than [0, -7].
function sortedIntervals(pcs: number[], rootPc: number): number[] {
	return pcs.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
}

// Deep-ish equality on two interval arrays. Sorts both because callers may
// pass them in either order — patterns are written sorted, but query input
// might not be.
function intervalsEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort((x, y) => x - y);
	const sortedB = [...b].sort((x, y) => x - y);
	for (let i = 0; i < sortedA.length; i++) {
		if (sortedA[i] !== sortedB[i]) return false;
	}
	return true;
}

// Pretty names for the 11 intervals between two notes (used only for the
// 2-note fallback case when the interval isn't a recognised power chord).
const INTERVAL_NAMES: Record<number, string> = {
	1: "m2",
	2: "M2",
	3: "m3",
	4: "M3",
	5: "P4",
	6: "TT",
	7: "P5",
	8: "m6",
	9: "M6",
	10: "m7",
	11: "M7",
};

// Tension labels used by the "add" pass — what to call an interval when it's
// the *extra* note on top of a recognised core pattern. e.g. interval 2 over
// a major triad → "9", interval 6 → "#11".
const TENSION_NAMES: Record<number, string> = {
	1: "b9",
	2: "9",
	3: "#9",
	5: "11",
	6: "#11",
	8: "b13",
	9: "13",
	11: "maj7",
};

// Intervals we'll consider "omittable" — the chord-defining tones (3rd, 5th, 7th
// and their altered forms). We never call a missing tension an omit (e.g. a 9
// chord missing its 9 isn't "9 omit9", it's just the underlying 7th chord).
const OMIT_ALLOWED = new Set([3, 4, 6, 7, 8, 10, 11]);

// Map an omitted interval back to the chord-degree name to display.
// e.g. "C7 omit5" reads better than "C7 omit7" (the 7 is in C7's name already).
function omitNumber(interval: number): string {
	switch (interval) {
		case 3:
		case 4:
			return "3"; // minor or major third → "3"
		case 6:
			return "b5";
		case 7:
			return "5";
		case 8:
			return "#5";
		case 10:
		case 11:
			return "7"; // minor or major seventh → "7"
		default:
			return String(interval);
	}
}

// Main entry point. Given a set of MIDI notes currently being played, return
// the most likely chord description, or null when the input is empty.
export function recognizeChord(midiNotes: Iterable<number>): RecognizedChord | null {
	// Deduplicate MIDI numbers (same pitch in two octaves doesn't help us)
	// and sort ascending so the lowest note is at index 0 — that's our bass.
	const sorted = Array.from(new Set(midiNotes)).sort((a, b) => a - b);
	if (sorted.length === 0) return null;

	// --- Single-note: return "C4" / "F#5" etc. -------------------------------
	if (sorted.length === 1) {
		const midi = sorted[0];
		const name = SHARP_NOTE_NAMES[midi % 12];
		const octave = Math.floor(midi / 12) - 1;
		return {
			label: `${name}${octave}`,
			rootName: name,
			quality: null,
			bassName: null,
			inversion: false,
			noteCount: 1,
		};
	}

	// Bass = lowest pitch class actually played (not necessarily the root).
	const bassPc = sorted[0] % 12;
	// Distinct pitch classes — chord recognition is octave-agnostic.
	const pcSet = new Set(sorted.map((n) => n % 12));
	const pcs = Array.from(pcSet);

	// --- Two-note: power chord (P5) or labelled interval ---------------------
	if (pcs.length === 2) {
		const interval = (pcs[1] - pcs[0] + 12) % 12;
		if (interval === 7) {
			// Treat a P5 as a power chord — most useful labelling in practice.
			return {
				label: `${SHARP_NOTE_NAMES[pcs[0]]}5`,
				rootName: SHARP_NOTE_NAMES[pcs[0]],
				quality: "5",
				bassName: null,
				inversion: false,
				noteCount: 2,
			};
		}
		// Any other dyad: just name both notes plus the interval class.
		const intervalName = INTERVAL_NAMES[interval] ?? `${interval}`;
		return {
			label: `${SHARP_NOTE_NAMES[pcs[0]]} ${SHARP_NOTE_NAMES[pcs[1]]} (${intervalName})`,
			rootName: null,
			quality: null,
			bassName: null,
			inversion: false,
			noteCount: 2,
		};
	}

	// --- Pass 1: exact pattern match ----------------------------------------
	// Try every pitch class as the candidate root; keep the highest-scoring
	// (priority + bass bonus) exact match.
	let best: { rootPc: number; pattern: ChordPattern; score: number } | null = null;

	for (const rootPc of pcs) {
		const intervals = sortedIntervals(pcs, rootPc);
		for (const pattern of CHORD_PATTERNS) {
			if (!intervalsEqual(intervals, pattern.intervals)) continue;
			let score = pattern.priority;
			// Prefer interpretations where the bass note IS the root —
			// avoids spuriously calling a C-major triad "Em#5" with a weird bass.
			if (rootPc === bassPc) score += 50;
			if (!best || score > best.score) {
				best = { rootPc, pattern, score };
			}
		}
	}

	// --- Pass 2: "add" / partial match (held notes ⊋ pattern) ----------------
	// Only run if no exact match was found AND we have enough notes to make
	// claiming an extension worthwhile.
	let partialBest: {
		rootPc: number;
		pattern: ChordPattern;
		extras: number[];
		score: number;
	} | null = null;

	if (!best && pcs.length >= 4) {
		for (const rootPc of pcs) {
			const intervals = sortedIntervals(pcs, rootPc);
			const intervalSet = new Set(intervals);
			for (const pattern of CHORD_PATTERNS) {
				if (pattern.intervals.length < 3) continue;            // triads minimum
				if (pattern.intervals.length >= intervals.length) continue; // need a STRICT subset
				const isSubset = pattern.intervals.every((iv) => intervalSet.has(iv));
				if (!isSubset) continue;
				const patternSet = new Set(pattern.intervals);
				const extras = intervals.filter((iv) => !patternSet.has(iv));
				// Score: pattern priority, penalised by extras (each tension costs
				// 20), boosted when bass==root and by pattern size (richer patterns
				// are preferred when they fit).
				const score =
					pattern.priority - extras.length * 20 + (rootPc === bassPc ? 50 : 0) + pattern.intervals.length * 3;
				if (!partialBest || score > partialBest.score) {
					partialBest = { rootPc, pattern, extras, score };
				}
			}
		}
	}

	// Subset / "omit" pass — the played notes fit inside a larger known pattern,
	// missing one or two chord-defining tones (3rd, 5th, or 7th). Covers shell
	// voicings (e.g. C7 with no 5, Cmaj7 with no 5) and other common drop-tone
	// voicings that the superset pass above can't see.
	let omitBest: {
		rootPc: number;
		pattern: ChordPattern;
		missing: number[];
		score: number;
	} | null = null;

	if (!best && pcs.length >= 3) {
		for (const rootPc of pcs) {
			const intervals = sortedIntervals(pcs, rootPc);
			const intervalSet = new Set(intervals);
			for (const pattern of CHORD_PATTERNS) {
				if (pattern.intervals.length <= intervals.length) continue; // need a STRICT superset
				const patternSet = new Set(pattern.intervals);
				const isSubset = intervals.every((iv) => patternSet.has(iv));
				if (!isSubset) continue;
				const missing = pattern.intervals.filter((iv) => !intervalSet.has(iv));
				// Allow at most 2 omitted tones, all of which must be chord-defining.
				if (missing.length === 0 || missing.length > 2) continue;
				if (!missing.every((iv) => OMIT_ALLOWED.has(iv))) continue;
				const score = pattern.priority - missing.length * 40 + (rootPc === bassPc ? 50 : 0);
				if (!omitBest || score > omitBest.score) {
					omitBest = { rootPc, pattern, missing, score };
				}
			}
		}
	}

	// --- Render winner -------------------------------------------------------

	if (best) {
		// Exact pattern match found — formal label.
		const rootName = SHARP_NOTE_NAMES[best.rootPc];
		const isInverted = best.rootPc !== bassPc;
		const bassName = isInverted ? SHARP_NOTE_NAMES[bassPc] : null;
		const base = `${rootName}${best.pattern.symbol}`;
		const label = isInverted ? `${base}/${bassName}` : base;
		return {
			label,
			rootName,
			quality: best.pattern.symbol,
			bassName,
			inversion: isInverted,
			noteCount: pcs.length,
		};
	}

	// If we got both an "omit" and an "add" candidate, pick whichever scored
	// higher. This matters for ambiguous voicings (e.g. C–E–B can read as
	// Cmaj7 omit5 OR as Em7 add… — score it).
	const preferOmit = omitBest !== null && (partialBest === null || omitBest.score > partialBest.score);

	if (preferOmit && omitBest) {
		const rootName = SHARP_NOTE_NAMES[omitBest.rootPc];
		const isInverted = omitBest.rootPc !== bassPc;
		const bassName = isInverted ? SHARP_NOTE_NAMES[bassPc] : null;
		const base = `${rootName}${omitBest.pattern.symbol}`;
		// e.g. "C7 omit5" or "C7 omit3,5"
		const omitLabels = omitBest.missing.map(omitNumber);
		const suffix = ` omit${omitLabels.join(",")}`;
		const label = isInverted ? `${base}${suffix}/${bassName}` : `${base}${suffix}`;
		return {
			label,
			rootName,
			quality: `${omitBest.pattern.symbol}${suffix}`,
			bassName,
			inversion: isInverted,
			noteCount: pcs.length,
		};
	}

	if (partialBest) {
		const rootName = SHARP_NOTE_NAMES[partialBest.rootPc];
		const isInverted = partialBest.rootPc !== bassPc;
		const bassName = isInverted ? SHARP_NOTE_NAMES[bassPc] : null;
		const base = `${rootName}${partialBest.pattern.symbol}`;
		// Each extra note becomes either a named tension ("9", "#11") or the
		// raw note name if it's not on the tension table.
		const tensionLabels = partialBest.extras.map((iv) => TENSION_NAMES[iv] ?? SHARP_NOTE_NAMES[(partialBest!.rootPc + iv) % 12]);
		const suffix = tensionLabels.length > 0 ? ` add${tensionLabels.join(",")}` : "";
		const label = isInverted ? `${base}${suffix}/${bassName}` : `${base}${suffix}`;
		return {
			label,
			rootName,
			quality: `${partialBest.pattern.symbol}${suffix}`,
			bassName,
			inversion: isInverted,
			noteCount: pcs.length,
		};
	}

	// No pattern fit — fall back to "C D# G B" so the chord display still
	// has something to show. Better than going blank mid-improv.
	const noteListing = pcs.map((pc) => SHARP_NOTE_NAMES[pc]).join(" ");
	return {
		label: noteListing,
		rootName: null,
		quality: null,
		bassName: null,
		inversion: false,
		noteCount: pcs.length,
	};
}
