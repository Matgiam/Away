export type ParsedNote = {
	midi: number;
	velocity: number;
	startSeconds: number;
	durationSeconds: number;
	track: number;
	channel: number;
};

export type ParsedPedalEvent = {
	timeSeconds: number;
	channel: number;
	on: boolean;
};

export type ParsedMidi = {
	notes: ParsedNote[];
	pedalEvents: ParsedPedalEvent[];
	durationSeconds: number;
	ppq: number;
	initialTempoBpm: number;
	trackCount: number;
};

type Reader = {
	view: DataView;
	pos: number;
};

const HEADER_CHUNK = 0x4d546864;
const TRACK_CHUNK = 0x4d54726b;

function read32(r: Reader): number {
	const v = r.view.getUint32(r.pos);
	r.pos += 4;
	return v;
}

function read16(r: Reader): number {
	const v = r.view.getUint16(r.pos);
	r.pos += 2;
	return v;
}

function read8(r: Reader): number {
	return r.view.getUint8(r.pos++);
}

function readVarLen(r: Reader): number {
	let value = 0;
	while (true) {
		const byte = read8(r);
		value = (value << 7) | (byte & 0x7f);
		if ((byte & 0x80) === 0) return value;
	}
}

type TempoChange = { tick: number; microsPerQuarter: number };

type RawEvent = {
	tick: number;
	type: "noteOn" | "noteOff";
	midi: number;
	velocity: number;
	channel: number;
	track: number;
};

type RawPedal = {
	tick: number;
	channel: number;
	on: boolean;
};

export function parseMidi(buffer: ArrayBuffer): ParsedMidi {
	const view = new DataView(buffer);
	const r: Reader = { view, pos: 0 };

	if (read32(r) !== HEADER_CHUNK) throw new Error("Not a MIDI file");
	const headerLength = read32(r);
	const headerEnd = r.pos + headerLength;
	read16(r); // format
	const tracks = read16(r);
	const division = read16(r);
	r.pos = headerEnd;

	let ppq = 480;
	if ((division & 0x8000) === 0) {
		ppq = division;
	} else {
		const framesPerSec = -((division >> 8) | 0xffffff00);
		const ticksPerFrame = division & 0xff;
		ppq = framesPerSec * ticksPerFrame;
	}

	const tempoChanges: TempoChange[] = [];
	const events: RawEvent[] = [];
	const rawPedals: RawPedal[] = [];

	for (let t = 0; t < tracks; t++) {
		while (r.pos < view.byteLength - 8) {
			if (read32(r) === TRACK_CHUNK) break;
			r.pos -= 3;
		}
		if (r.pos >= view.byteLength) break;
		const length = read32(r);
		const trackEnd = r.pos + length;
		let tick = 0;
		let runningStatus = 0;
		const openNotes = new Map<number, { tick: number; velocity: number; channel: number }>();

		while (r.pos < trackEnd) {
			tick += readVarLen(r);
			let status = read8(r);
			if (status < 0x80) {
				r.pos--;
				status = runningStatus;
			} else {
				runningStatus = status;
			}

			const high = status & 0xf0;
			const channel = status & 0x0f;

			if (status === 0xff) {
				const metaType = read8(r);
				const metaLen = readVarLen(r);
				if (metaType === 0x51 && metaLen === 3) {
					const a = read8(r);
					const b = read8(r);
					const c = read8(r);
					tempoChanges.push({ tick, microsPerQuarter: (a << 16) | (b << 8) | c });
				} else {
					r.pos += metaLen;
				}
			} else if (status === 0xf0 || status === 0xf7) {
				const sysexLen = readVarLen(r);
				r.pos += sysexLen;
			} else if (high === 0x90) {
				const midi = read8(r);
				const velocity = read8(r);
				if (velocity > 0) {
					const key = (channel << 8) | midi;
					openNotes.set(key, { tick, velocity, channel });
				} else {
					closeNote(openNotes, events, t, channel, midi, tick);
				}
			} else if (high === 0x80) {
				const midi = read8(r);
				read8(r); // release velocity
				closeNote(openNotes, events, t, channel, midi, tick);
			} else if (high === 0xb0) {
				const controller = read8(r);
				const value = read8(r);
				// CC64 = sustain pedal. MIDI spec: 0–63 = off, 64–127 = on.
				if (controller === 64) {
					rawPedals.push({ tick, channel, on: value >= 64 });
				}
			} else if (high === 0xa0 || high === 0xe0) {
				r.pos += 2;
			} else if (high === 0xc0 || high === 0xd0) {
				r.pos += 1;
			} else {
				r.pos++;
			}
		}

		openNotes.forEach((open, key) => {
			const midi = key & 0xff;
			const channel = (key >> 8) & 0xff;
			events.push({
				tick: open.tick,
				type: "noteOn",
				midi,
				velocity: open.velocity,
				channel,
				track: t,
			});
			events.push({
				tick: tick,
				type: "noteOff",
				midi,
				velocity: 0,
				channel,
				track: t,
			});
		});

		r.pos = trackEnd;
	}

	tempoChanges.sort((a, b) => a.tick - b.tick);
	if (tempoChanges.length === 0 || tempoChanges[0].tick !== 0) {
		tempoChanges.unshift({ tick: 0, microsPerQuarter: 500000 });
	}

	const ticksToSeconds = buildTickConverter(tempoChanges, ppq);

	type Pending = { startTick: number; velocity: number };
	const open = new Map<string, Pending>();
	const notes: ParsedNote[] = [];

	events.sort((a, b) => a.tick - b.tick);

	for (const ev of events) {
		const key = `${ev.track}:${ev.channel}:${ev.midi}`;
		if (ev.type === "noteOn") {
			open.set(key, { startTick: ev.tick, velocity: ev.velocity });
		} else {
			const pending = open.get(key);
			if (!pending) continue;
			open.delete(key);
			const startSec = ticksToSeconds(pending.startTick);
			const endSec = ticksToSeconds(ev.tick);
			notes.push({
				midi: ev.midi,
				velocity: pending.velocity,
				startSeconds: startSec,
				durationSeconds: Math.max(0.05, endSec - startSec),
				track: ev.track,
				channel: ev.channel,
			});
		}
	}

	notes.sort((a, b) => a.startSeconds - b.startSeconds);

	const durationSeconds = notes.reduce(
		(max, n) => Math.max(max, n.startSeconds + n.durationSeconds),
		0,
	);

	rawPedals.sort((a, b) => a.tick - b.tick);
	const pedalEvents: ParsedPedalEvent[] = [];
	const lastPedalState = new Map<number, boolean>();
	for (const p of rawPedals) {
		// Skip redundant toggles — many MIDI files send CC64=0 repeatedly between
		// presses, which would cause unnecessary engine calls during playback.
		if (lastPedalState.get(p.channel) === p.on) continue;
		lastPedalState.set(p.channel, p.on);
		pedalEvents.push({
			timeSeconds: ticksToSeconds(p.tick),
			channel: p.channel,
			on: p.on,
		});
	}

	const initialTempoBpm = Math.round(60000000 / tempoChanges[0].microsPerQuarter);

	return {
		notes,
		pedalEvents,
		durationSeconds,
		ppq,
		initialTempoBpm,
		trackCount: tracks,
	};
}

function closeNote(
	openNotes: Map<number, { tick: number; velocity: number; channel: number }>,
	events: RawEvent[],
	track: number,
	channel: number,
	midi: number,
	tick: number,
) {
	const key = (channel << 8) | midi;
	const open = openNotes.get(key);
	if (!open) return;
	openNotes.delete(key);
	events.push({
		tick: open.tick,
		type: "noteOn",
		midi,
		velocity: open.velocity,
		channel,
		track,
	});
	events.push({
		tick,
		type: "noteOff",
		midi,
		velocity: 0,
		channel,
		track,
	});
}

function buildTickConverter(tempoChanges: TempoChange[], ppq: number) {
	type Stop = { tick: number; secondsAtTick: number; secondsPerTick: number };
	const stops: Stop[] = [];

	let cumulative = 0;
	for (let i = 0; i < tempoChanges.length; i++) {
		const cur = tempoChanges[i];
		if (i === 0) {
			stops.push({ tick: cur.tick, secondsAtTick: 0, secondsPerTick: cur.microsPerQuarter / 1_000_000 / ppq });
			continue;
		}
		const prev = stops[stops.length - 1];
		const delta = cur.tick - prev.tick;
		cumulative = prev.secondsAtTick + delta * prev.secondsPerTick;
		stops.push({ tick: cur.tick, secondsAtTick: cumulative, secondsPerTick: cur.microsPerQuarter / 1_000_000 / ppq });
	}

	return (tick: number): number => {
		let i = stops.length - 1;
		while (i > 0 && stops[i].tick > tick) i--;
		const stop = stops[i];
		return stop.secondsAtTick + (tick - stop.tick) * stop.secondsPerTick;
	};
}
