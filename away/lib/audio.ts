import * as Tone from "tone";
import { instruments } from "./types";

export const initAudioContext = async () => {
  const context = new Tone.Context({ latencyHint: "interactive" });
  Tone.setContext(context);
  Tone.context.lookAhead = 0;
};

export const createSampler = (instKey: string, onload: () => void) => {
  return new Tone.Sampler({
	urls: instruments[instKey].urls,
		baseUrl: instruments[instKey].baseUrl,
    release: 1.5,
    onload,
  });
};

export const createReverb = (wet: number) => {
  return new Tone.Reverb({ decay: 2, wet }).toDestination();
};
