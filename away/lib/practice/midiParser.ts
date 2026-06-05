// ============================================================================
// practice/midiParser.ts
// ----------------------------------------------------------------------------
// Custom Standard MIDI File (SMF) parser. Produces a `ParsedMidi` with notes,
// pedal events, duration, PPQ, initial tempo and track count.
//
// Why a custom parser:
//   * @tonejs/midi works fine in the browser but pulls in extra deps the
//     server-side catalog walker doesn't need.
//   * This parser is deliberately minimal — it understands the events the
//     falling-notes player actually uses (note on/off, sustain pedal CC64,
//     tempo meta-events) and skips everything else.
//
// Format reference: http://www.somascape.org/midi/tech/mfile.html
// ============================================================================

// Single note instance — once a note-off has paired with its note-on.
export type ParsedNote = {
	midi: number;
	velocity: number;          // 1-127 from the note-on
	startSeconds: number;
	durationSeconds: number;   // floored at 0.05s so zero-length notes still render
	track: number;
	channel: number;
};

// One sustain pedal transition (CC64).
export type ParsedPedalEvent = {
	timeSeconds: number;
	channel: number;
	on: boolean;
};

// The output shape — feeds the falling-notes view, the chord builder, and the
// difficulty estimator.
export type ParsedMidi = {
	notes: ParsedNote[];
	pedalEvents: ParsedPedalEvent[];
	durationSeconds: number;
	ppq: number;             // pulses per quarter note (from the header)
	initialTempoBpm: number; // tempo at tick 0
	// True iff the file itself contained at least one tempo meta event. When
	// false, `initialTempoBpm` is the SMF default (120) and the caller may want
	// to let the user pick a real tempo.
	tempoDetected: boolean;
	trackCount: number;
};

// Cursor object passed around the read* helpers — avoids returning [value, newPos]
// tuples from every byte read.
type Reader = {
	view: DataView;
	pos: number;
};

// SMF magic numbers ("MThd" and "MTrk" as big-endian uint32s).
const HEADER_CHUNK = 0x4d546864;
const TRACK_CHUNK = 0x4d54726b;

// --- Tiny big-endian readers ------------------------------------------------

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

// SMF variable-length quantity. 7 bits per byte; high bit set = "more bytes
// follow". Used for delta times and event lengths.
function readVarLen(r: Reader): number {
	let value = 0;
	while (true) {
		const byte = read8(r);
		value = (value << 7) | (byte & 0x7f);
		if ((byte & 0x80) === 0) return value;
	}
}

type TempoChange = { tick: number; microsPerQuarter: number };

// Intermediate event used during track scanning — we collect ons + offs
// separately and pair them up after we've built the tempo map.
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

// Main entry point. Returns a fully-parsed MIDI ready for the practice view.
// Throws on a missing "MThd" header; everything else is best-effort recovery.
export function parseMidi(buffer: ArrayBuffer): ParsedMidi {
	const view = new DataView(buffer);
	const r: Reader = { view, pos: 0 };

	// --- Header chunk ---
	if (read32(r) !== HEADER_CHUNK) throw new Error("Not a MIDI file");
	const headerLength = read32(r);
	const headerEnd = r.pos + headerLength;
	read16(r); // format (0/1/2) — we don't differentiate
	const tracks = read16(r);
	const division = read16(r);
	r.pos = headerEnd; // skip any header padding

	// `division` encodes either PPQ (high bit clear) or SMPTE time (high bit
	// set). We support both; SMPTE files are rare but show up in some game
	// rips.
	let ppq = 480;
	if ((division & 0x8000) === 0) {
		ppq = division; // straightforward PPQ
	} else {
		// SMPTE: top byte = -frames/sec, bottom = ticks/frame. Convert to a
		// pseudo-PPQ so the rest of the code path doesn't care.
		const framesPerSec = -((division >> 8) | 0xffffff00);
		const ticksPerFrame = division & 0xff;
		ppq = framesPerSec * ticksPerFrame;
	}

	const tempoChanges: TempoChange[] = [];
	const events: RawEvent[] = [];
	const rawPedals: RawPedal[] = [];

	// --- Track chunks ---
	for (let t = 0; t < tracks; t++) {
		// Some files have garbage between MThd and the first MTrk — scan forward
		// to find the next track chunk header.
		while (r.pos < view.byteLength - 8) {
			if (read32(r) === TRACK_CHUNK) break;
			r.pos -= 3; // step forward one byte at a time
		}
		if (r.pos >= view.byteLength) break;

		const length = read32(r);
		const trackEnd = r.pos + length;
		let tick = 0;
		let runningStatus = 0;
		// MIDI key = (channel << 8 | note) so two channels can hold the same
		// note simultaneously without colliding.
		const openNotes = new Map<number, { tick: number; velocity: number; channel: number }>();

		while (r.pos < trackEnd) {
			tick += readVarLen(r); // delta time
			let status = read8(r);
			// Running status: if the byte is a data byte, reuse the last status.
			if (status < 0x80) {
				r.pos--;
				status = runningStatus;
			} else {
				runningStatus = status;
			}

			const high = status & 0xf0;
			const channel = status & 0x0f;

			if (status === 0xff) {
				// Meta event. Only tempo (0x51) actually matters to us; everything
				// else is text/track-name/etc. and we skip its body.
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
				// SysEx — skip the whole body.
				const sysexLen = readVarLen(r);
				r.pos += sysexLen;
			} else if (high === 0x90) {
				// Note On (channel-relative).
				const midi = read8(r);
				const velocity = read8(r);
				if (velocity > 0) {
					// Real note-on. Stash so we can compute duration when its
					// matching note-off arrives.
					const key = (channel << 8) | midi;
					openNotes.set(key, { tick, velocity, channel });
				} else {
					// Velocity 0 = "running" note-off per the MIDI spec.
					closeNote(openNotes, events, t, channel, midi, tick);
				}
			} else if (high === 0x80) {
				// Note Off proper.
				const midi = read8(r);
				read8(r); // release velocity (ignored)
				closeNote(openNotes, events, t, channel, midi, tick);
			} else if (high === 0xb0) {
				// Control Change.
				const controller = read8(r);
				const value = read8(r);
				// CC64 = sustain pedal. MIDI spec: 0–63 = off, 64–127 = on.
				if (controller === 64) {
					rawPedals.push({ tick, channel, on: value >= 64 });
				}
			} else if (high === 0xa0 || high === 0xe0) {
				r.pos += 2; // poly aftertouch / pitch bend — skip 2 data bytes
			} else if (high === 0xc0 || high === 0xd0) {
				r.pos += 1; // program change / channel pressure — 1 data byte
			} else {
				r.pos++; // unknown status — skip a byte and hope for the best
			}
		}

		// If we hit the end of the track with notes still hanging, force-close
		// them at the current tick so they at least render.
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

	// --- Build the tick → seconds converter ---
	tempoChanges.sort((a, b) => a.tick - b.tick);
	const tempoDetected = tempoChanges.length > 0;
	// SMF spec: if no tempo is set, default to 120 BPM (500_000 µs/quarter).
	if (tempoChanges.length === 0 || tempoChanges[0].tick !== 0) {
		tempoChanges.unshift({ tick: 0, microsPerQuarter: 500000 });
	}

	const ticksToSeconds = buildTickConverter(tempoChanges, ppq);

	// --- Pair note-ons with note-offs and convert to ParsedNote ---
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
			if (!pending) continue; // orphan note-off — skip
			open.delete(key);
			const startSec = ticksToSeconds(pending.startTick);
			const endSec = ticksToSeconds(ev.tick);
			notes.push({
				midi: ev.midi,
				velocity: pending.velocity,
				startSeconds: startSec,
				// 0.05s minimum so zero-length notes (some MIDI editors produce
				// these) still appear as a visible falling block.
				durationSeconds: Math.max(0.05, endSec - startSec),
				track: ev.track,
				channel: ev.channel,
			});
		}
	}

	notes.sort((a, b) => a.startSeconds - b.startSeconds);

	// Duration = where the latest note ends.
	const durationSeconds = notes.reduce(
		(max, n) => Math.max(max, n.startSeconds + n.durationSeconds),
		0,
	);

	// --- Pedal events: deduplicate and convert to seconds ---
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

	// BPM = 60_000_000 / µs-per-quarter (standard MIDI relation).
	const initialTempoBpm = Math.round(60000000 / tempoChanges[0].microsPerQuarter);

	return {
		notes,
		pedalEvents,
		durationSeconds,
		ppq,
		initialTempoBpm,
		tempoDetected,
		trackCount: tracks,
	};
}

// Bakes an initial tempo meta event (FF 51 03) into the first MTrk chunk so the
// file is self-contained for every consumer of `parseMidi`. Used by the upload
// flow when the dropped file has no tempo events and the user picked a BPM
// manually — we'd rather rewrite the bytes once than thread a tempo override
// through every playback path.
export function injectInitialTempo(buffer: ArrayBuffer, bpm: number): ArrayBuffer {
	const safeBpm = Math.max(20, Math.min(400, Math.round(bpm)));
	const microsPerQuarter = Math.round(60_000_000 / safeBpm);

	const view = new DataView(buffer);
	if (view.getUint32(0) !== HEADER_CHUNK) throw new Error("Not a MIDI file");
	const headerLength = view.getUint32(4);

	// Find the first MTrk after the header. Some files have padding bytes
	// between MThd and the first MTrk, so we scan one byte at a time.
	let trackHeaderStart = 8 + headerLength;
	while (trackHeaderStart < view.byteLength - 8) {
		if (view.getUint32(trackHeaderStart) === TRACK_CHUNK) break;
		trackHeaderStart++;
	}
	if (trackHeaderStart >= view.byteLength - 8) throw new Error("No track in MIDI file");

	const trackLength = view.getUint32(trackHeaderStart + 4);
	const trackDataStart = trackHeaderStart + 8;

	// VLQ(0) + meta header (FF 51 03) + 3-byte microsPerQuarter (big-endian).
	const tempoBytes = new Uint8Array([
		0x00,
		0xff,
		0x51,
		0x03,
		(microsPerQuarter >> 16) & 0xff,
		(microsPerQuarter >> 8) & 0xff,
		microsPerQuarter & 0xff,
	]);

	const original = new Uint8Array(buffer);
	const out = new Uint8Array(buffer.byteLength + tempoBytes.length);
	out.set(original.subarray(0, trackDataStart), 0);
	out.set(tempoBytes, trackDataStart);
	out.set(original.subarray(trackDataStart), trackDataStart + tempoBytes.length);

	new DataView(out.buffer).setUint32(trackHeaderStart + 4, trackLength + tempoBytes.length);
	return out.buffer;
}

// Helper used by both the running-status note-off path and the explicit
// 0x80 path — pulls an open note from the map and writes a paired on/off
// event to the events array.
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

// Builds a piecewise-linear tick→seconds function from the tempo change list.
// Each segment between two tempo changes has a constant secondsPerTick; we
// integrate forward to get the absolute time at each tempo change boundary,
// then linearly extrapolate within a segment.
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

	// Returned closure finds the last stop ≤ tick and extrapolates.
	return (tick: number): number => {
		let i = stops.length - 1;
		while (i > 0 && stops[i].tick > tick) i--;
		const stop = stops[i];
		return stop.secondsAtTick + (tick - stop.tick) * stop.secondsPerTick;
	};
}
