import * as Tone from "tone";
import type { Instrument } from "./types";

export const initAudioContext = async () => {
	const context = new Tone.Context({ latencyHint: "interactive" });
	Tone.setContext(context);
	Tone.context.lookAhead = 0;
};

export const createSampler = (instrument: Instrument, onload: () => void): Tone.Sampler => {
	return new Tone.Sampler({
		urls: instrument.urls,
		baseUrl: instrument.baseUrl,
		release: instrument.release ?? 1.5,
		onload,
	});
};

export const createMasterVolume = (db: number): Tone.Volume => {
	return new Tone.Volume(db).toDestination();
};

export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => {
	const reverb = new Tone.Reverb({ decay: 3.5, wet });
	if (output) {
		reverb.connect(output);
	} else {
		reverb.toDestination();
	}
	return reverb;
};
