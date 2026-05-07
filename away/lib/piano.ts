import { PianoKey } from "./types";
import { PLAYER_COLORS } from "./playerColors";

export const generatePiano = (): PianoKey[] => {
	const keys: PianoKey[] = [];
	let whiteKeyIndex = 0;
	for (let midi = 21; midi <= 108; midi++) {
		const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		const noteName = notes[midi % 12];
		const isBlack = noteName.includes("#");
		keys.push({
			midi,
			noteName: `${noteName}${Math.floor(midi / 12) - 1}`,
			isBlack,
			whiteKeyIndex: !isBlack ? whiteKeyIndex++ : whiteKeyIndex - 1,
			color: PLAYER_COLORS[0],
		});
	}
	return keys;
};
