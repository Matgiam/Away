const SHARP_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export type RecognizedChord = {
	label: string;
	rootName: string | null;
	quality: string | null;
	bassName: string | null;
	inversion: boolean;
	noteCount: number;
};

type ChordPattern = {
	intervals: number[];
	symbol: string;
	priority: number;
};

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

function sortedIntervals(pcs: number[], rootPc: number): number[] {
	return pcs.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
}

function intervalsEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort((x, y) => x - y);
	const sortedB = [...b].sort((x, y) => x - y);
	for (let i = 0; i < sortedA.length; i++) {
		if (sortedA[i] !== sortedB[i]) return false;
	}
	return true;
}

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

export function recognizeChord(midiNotes: Iterable<number>): RecognizedChord | null {
	const sorted = Array.from(new Set(midiNotes)).sort((a, b) => a - b);
	if (sorted.length === 0) return null;

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

	const bassPc = sorted[0] % 12;
	const pcSet = new Set(sorted.map((n) => n % 12));
	const pcs = Array.from(pcSet);

	if (pcs.length === 2) {
		const interval = (pcs[1] - pcs[0] + 12) % 12;
		if (interval === 7) {
			return {
				label: `${SHARP_NOTE_NAMES[pcs[0]]}5`,
				rootName: SHARP_NOTE_NAMES[pcs[0]],
				quality: "5",
				bassName: null,
				inversion: false,
				noteCount: 2,
			};
		}
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

	let best: { rootPc: number; pattern: ChordPattern; score: number } | null = null;

	for (const rootPc of pcs) {
		const intervals = sortedIntervals(pcs, rootPc);
		for (const pattern of CHORD_PATTERNS) {
			if (!intervalsEqual(intervals, pattern.intervals)) continue;
			let score = pattern.priority;
			if (rootPc === bassPc) score += 50;
			if (!best || score > best.score) {
				best = { rootPc, pattern, score };
			}
		}
	}

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
				if (pattern.intervals.length < 3) continue;
				if (pattern.intervals.length >= intervals.length) continue;
				const isSubset = pattern.intervals.every((iv) => intervalSet.has(iv));
				if (!isSubset) continue;
				const patternSet = new Set(pattern.intervals);
				const extras = intervals.filter((iv) => !patternSet.has(iv));
				const score =
					pattern.priority - extras.length * 20 + (rootPc === bassPc ? 50 : 0) + pattern.intervals.length * 3;
				if (!partialBest || score > partialBest.score) {
					partialBest = { rootPc, pattern, extras, score };
				}
			}
		}
	}

	if (!best && !partialBest) {
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

	if (!best && partialBest) {
		const rootName = SHARP_NOTE_NAMES[partialBest.rootPc];
		const isInverted = partialBest.rootPc !== bassPc;
		const bassName = isInverted ? SHARP_NOTE_NAMES[bassPc] : null;
		const base = `${rootName}${partialBest.pattern.symbol}`;
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

	const rootName = SHARP_NOTE_NAMES[best!.rootPc];
	const isInverted = best!.rootPc !== bassPc;
	const bassName = isInverted ? SHARP_NOTE_NAMES[bassPc] : null;
	const base = `${rootName}${best!.pattern.symbol}`;
	const label = isInverted ? `${base}/${bassName}` : base;

	return {
		label,
		rootName,
		quality: best!.pattern.symbol,
		bassName,
		inversion: isInverted,
		noteCount: pcs.length,
	};
}
