"use client";
import { useEffect, useState } from "react";

export default function MidiReader() {
	const [midiStatus, setMidiStatus] = useState<string>("Requesting MIDI permission...");
	const [keyInfo, setKeyInfo] = useState<string>("Press a key...");

	useEffect(() => {
		const nav = navigator as any;

		if (nav.requestMIDIAccess) {
			nav.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
		} else {
			setMidiStatus("Web MIDI is not supported.");
		}

		function onMIDISuccess(midiAccess: any) {
			setMidiStatus("MIDI Access ok");

			for (const input of midiAccess.inputs.values()) {
				input.onmidimessage = handleMIDIMessage;
			}
		}

		function onMIDIFailure() {
			setMidiStatus("Could not access your MIDI devices.");
		}
		function handleMIDIMessage(message: any) {
			const command = message.data[0];
			const note = message.data[1];
			const velocity = message.data.length > 2 ? message.data[2] : 0;

			if (command === 144 && velocity > 0) {
				const powerPercentage = Math.round((velocity / 127) * 100);
				setKeyInfo(`You pressed MIDI note ${note} with ${powerPercentage}% power.`);
			}
		}
	}, []);

	return (
		<div  >
			<p>
				Status: <strong>{midiStatus}</strong>
			</p>
			<div >
				<h3 style={{ margin: 0 }}>{keyInfo}</h3>
			</div>
		</div>
	);
}
