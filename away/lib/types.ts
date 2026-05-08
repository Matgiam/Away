export type PianoKey = {
	midi: number;
	noteName: string;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
};

export type VisNote = {
	id: string;
	midi: number;
	startTime: number;
	endTime: number | null;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
	x: number;
	w: number;
	playerId: string;
};

export const THEME_COLOR = "rgba(219, 83, 97, 0.5)";

export type Instrument = {
	name: string;
	urls: Record<string, string>;
	baseUrl: string;
};

export const instruments: Record<string, Instrument> = {
	salamander_grand: {
		name: "Salamander Grand Piano",
		urls: {
			A0: "A0.mp3",
			C1: "C1.mp3",
			"D#1": "Ds1.mp3",
			"F#1": "Fs1.mp3",
			A1: "A1.mp3",
			C2: "C2.mp3",
			"D#2": "Ds2.mp3",
			"F#2": "Fs2.mp3",
			A2: "A2.mp3",
			C3: "C3.mp3",
			"D#3": "Ds3.mp3",
			"F#3": "Fs3.mp3",
			A3: "A3.mp3",
			C4: "C4.mp3",
			"D#4": "Ds4.mp3",
			"F#4": "Fs4.mp3",
			A4: "A4.mp3",
			C5: "C5.mp3",
			"D#5": "Ds5.mp3",
			"F#5": "Fs5.mp3",
			A5: "A5.mp3",
			C6: "C6.mp3",
			"D#6": "Ds6.mp3",
			"F#6": "Fs6.mp3",
			A6: "A6.mp3",
			C7: "C7.mp3",
			"D#7": "Ds7.mp3",
			"F#7": "Fs7.mp3",
			A7: "A7.mp3",
			C8: "C8.mp3",
		},
		baseUrl: "https://tonejs.github.io/audio/salamander/",
	},
	casio_ep: {
		name: "Casio Electric Piano",
		urls: {
			A1: "A1.mp3",
			A2: "A2.mp3",
			C4: "C4.mp3",
			"D#4": "Ds4.mp3",
			"F#4": "Fs4.mp3",
			A4: "A4.mp3",
		},
		baseUrl: "https://tonejs.github.io/audio/casio/",
	},
};

export const DEFAULT_SOUNDFONT = "salamander_grand";
