"use client";
import * as Tone from "tone";

export default function SoundTest() {
	const playNote = () => {
		//create a synth and connect it to the main output (your speakers)
		const synth = new Tone.Synth().toDestination();

		//play a middle 'C' for the duration of an 8th note
		synth.triggerAttackRelease("C4", "8n");
	};

	return (
		<div>
			<button onClick={playNote}>Play</button>
		</div>
	);
}
