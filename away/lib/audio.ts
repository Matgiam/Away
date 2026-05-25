import * as Tone from "tone";

// Returns the *native* AudioContext that Tone is wrapping. spessasynth_lib's
// AudioWorkletNode constructor fails the `instanceof BaseAudioContext` check
// against Tone's default standardized-audio-context wrapper, so we create the
// native context ourselves and hand it to both Tone and the spessasynth engine.
export const initAudioContext = async (): Promise<AudioContext> => {
	const native = new AudioContext({ latencyHint: "interactive" });
	const context = new Tone.Context({ context: native, latencyHint: "interactive" });
	Tone.setContext(context);
	Tone.context.lookAhead = 0;
	return native;
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
