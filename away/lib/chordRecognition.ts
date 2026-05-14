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
	{ intervals: [0, 7], symbol: "5", priority: 60 },

	{ intervals: [0, 4, 7], symbol: "", priority: 100 },
	{ intervals: [0, 3, 7], symbol: "m", priority: 100 },
	{ intervals: [0, 3, 6], symbol: "dim", priority: 95 },
	{ intervals: [0, 4, 8], symbol: "aug", priority: 95 },
	{ intervals: [0, 2, 7], symbol: "sus2", priority: 90 },
	{ intervals: [0, 5, 7], symbol: "sus4", priority: 90 },

	{ intervals: [0, 4, 7, 11], symbol: "maj7", priority: 120 },
	{ intervals: [0, 3, 7, 10], symbol: "m7", priority: 120 },
	{ intervals: [0, 4, 7, 10], symbol: "7", priority: 120 },
	{ intervals: [0, 3, 6, 9], symbol: "dim7", priority: 118 },
	{ intervals: [0, 3, 6, 10], symbol: "m7b5", priority: 117 },
	{ intervals: [0, 3, 7, 11], symbol: "mMaj7", priority: 116 },
	{ intervals: [0, 4, 7, 9], symbol: "6", priority: 110 },
	{ intervals: [0, 3, 7, 9], symbol: "m6", priority: 110 },
	{ intervals: [0, 5, 7, 10], symbol: "7sus4", priority: 108 },
	{ intervals: [0, 2, 7, 10], symbol: "7sus2", priority: 105 },
	{ intervals: [0, 4, 7, 2], symbol: "add9", priority: 95 },
	{ intervals: [0, 3, 7, 2], symbol: "madd9", priority: 95 },
	{ intervals: [0, 4, 8, 10], symbol: "7#5", priority: 115 },
	{ intervals: [0, 4, 6, 10], symbol: "7b5", priority: 115 },

	{ intervals: [0, 4, 7, 10, 2], symbol: "9", priority: 130 },
	{ intervals: [0, 4, 7, 11, 2], symbol: "maj9", priority: 130 },
	{ intervals: [0, 3, 7, 10, 2], symbol: "m9", priority: 130 },
	{ intervals: [0, 4, 7, 11, 9], symbol: "6/9", priority: 128 },
	{ intervals: [0, 4, 7, 10, 1], symbol: "7b9", priority: 125 },
	{ intervals: [0, 4, 7, 10, 3], symbol: "7#9", priority: 125 },
	{ intervals: [0, 4, 7, 10, 5], symbol: "7add11", priority: 122 },
	{ intervals: [0, 4, 7, 10, 9], symbol: "13no11", priority: 124 },

	{ intervals: [0, 4, 7, 10, 2, 5], symbol: "11", priority: 140 },
	{ intervals: [0, 3, 7, 10, 2, 5], symbol: "m11", priority: 140 },
	{ intervals: [0, 4, 7, 10, 2, 9], symbol: "13", priority: 145 },
	{ intervals: [0, 3, 7, 10, 2, 9], symbol: "m13", priority: 145 },
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

	if (!best) {
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
