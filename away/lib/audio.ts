import * as Tone from "tone";
import { instruments } from "./types";

export const initAudioContext = async () => {
	const context = new Tone.Context({ latencyHint: "interactive" });
	Tone.setContext(context);
	Tone.context.lookAhead = 0;
};

export const createSampler = (instKey: string, onload: () => void): Tone.Sampler => {
	return new Tone.Sampler({
		urls: instruments[instKey].urls,
		baseUrl: instruments[instKey].baseUrl,
		release: 1.5,
		onload,
	});
};

export const createMasterVolume = (db: number): Tone.Volume => {
	return new Tone.Volume(db).toDestination();
};

export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => {
	const reverb = new Tone.Reverb({ decay: 2, wet });
	if (output) {
		reverb.connect(output);
	} else {
		reverb.toDestination();
	}
	return reverb;
};
