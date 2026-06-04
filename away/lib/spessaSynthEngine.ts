// ============================================================================
// spessaSynthEngine.ts
// ----------------------------------------------------------------------------
// Thin wrapper around spessasynth_lib's `WorkletSynthesizer`, adding the
// per-player MIDI-channel routing the multiplayer code needs.
//
// Design:
//   * The local player ALWAYS plays on MIDI channel 0 (SELF_CHANNEL).
//   * Remote peers in a jam room are assigned channels 1–15 lazily.
//   * Channel 9 (MIDI drum slot) is skipped so we don't accidentally route
//     a melodic font through a drum kit mapper.
//   * Each loaded soundfont gets a unique `bankOffset` — that's how
//     spessasynth keeps multiple loaded banks separable in its preset list,
//     so peers can hold different instruments at the same time without
//     stomping on each other.
//
// Why the cache-invalidate dance in `doLoadFont`:
//   addSoundBank rebuilds the worklet's preset table. Any channel already
//   programmed to a preset that the new bank overrides will silently start
//   playing the new bank's sound. That was the "everyone's piano changes
//   when one user changes theirs" multiplayer bug — fixed by re-applying
//   every tracked channel's intended font right after addSoundBank lands.
// ============================================================================

import { WorkletSynthesizer } from "spessasynth_lib";

// Public path of the AudioWorklet processor. Copied at install time by
// scripts/sync-spessasynth-worklet.mjs from node_modules/spessasynth_lib/dist.
const WORKLET_URL = "/spessasynth/spessasynth_processor.min.js";

// Channel reserved for the local player. Peers start at 1.
export const SELF_CHANNEL = 0;
const MAX_CHANNELS = 16;
const DRUM_CHANNEL = 9; // MIDI convention; we skip it for melodic fonts.

// Identifies a single soundfont preset in spessasynth's lookup table.
// `bankMSB` / `bankLSB` together select the bank, then `program` picks the
// instrument inside that bank.
type PresetAddress = {
	bankMSB: number;
	bankLSB: number;
	program: number;
	isDrum: boolean;
};

// One entry in the engine's font registry.
type FontEntry = {
	/** The offset passed to addSoundBank. Same value lives in the resulting bankMSB of merged presets. */
	bankOffset: number;
	/** The preset we'll auto-select when this font is targeted on a channel. */
	defaultPreset: PresetAddress;
	/** True when the chosen preset is a drum kit — channel must be flipped to drum mode. */
	isDrum: boolean;
};

// Stable string key for a preset — used to diff the preset list before/after
// addSoundBank so we can find which presets were newly added by THIS load.
function presetKey(p: { bankMSB: number; bankLSB: number; program: number }): string {
	return `${p.bankMSB}:${p.bankLSB}:${p.program}`;
}

/**
 * Thin wrapper around spessasynth_lib's WorkletSynthesizer that exposes
 * the per-player MIDI-channel routing our app needs.
 *
 * - SELF always plays on channel 0.
 * - Peers are assigned channels 1..15 lazily (skipping 9, the MIDI drum slot).
 * - Each loaded soundfont gets a unique bankOffset so peer channels can
 *   simultaneously play different instruments via bank-select + programChange.
 */
export class SpessaSynthEngine {
	private synth: WorkletSynthesizer | null = null;
	/** A raw GainNode that aggregates the synth's 17 outputs. Route this into the rest of your chain. */
	output: GainNode | null = null;

	// --- Soundfont registry --------------------------------------------------
	// key  → loaded font entry (bank offset + default preset)
	private readonly fonts = new Map<string, FontEntry>();
	// key  → in-flight load Promise so concurrent loadFont() calls dedupe.
	private readonly inflightLoads = new Map<string, Promise<void>>();
	// Monotonically increasing bank offset assigned per font load.
	private nextBankOffset = 0;

	// --- Player ↔ channel mappings -------------------------------------------
	// Two-way map so we can look up either direction in O(1).
	private readonly playerChannels = new Map<string, number>();
	private readonly channelByPlayer = new Map<number, string>();
	/** Next channel slot to try when allocating a new peer. */
	private nextPeerChannel = 1;

	/** Currently-selected font on each channel — used to avoid redundant program changes. */
	private readonly channelFont = new Map<number, string>();

	// True once init() has run and an output node exists.
	get ready(): boolean {
		return this.synth !== null && this.output !== null;
	}

	// Lazy initialiser. Loads the worklet module, constructs the synthesizer,
	// and wires its outputs through a single GainNode for the caller to route.
	// Safe to call multiple times — subsequent calls return immediately.
	async init(ctx: AudioContext): Promise<void> {
		if (this.synth) return;
		await ctx.audioWorklet.addModule(WORKLET_URL);
		const synth = new WorkletSynthesizer(ctx);
		await synth.isReady; // worklet handshake
		const out = ctx.createGain();
		// Trim 4 dB off the synth bus before it hits the master chain. Piano
		// SoundFonts ship with samples normalised near 0 dBFS, so a handful of
		// simultaneous voices already runs the bus hot; once you stack 15+
		// the sum slams into the master limiter even at modest velocities,
		// which makes every new attack on top sound like maximum velocity.
		// 0.63 (~ -4 dB) keeps a single voice loud enough not to feel weak
		// but gives a dense chord serious headroom before any compression
		// downstream has to engage.
		out.gain.value = 0.63;
		synth.connect(out); // mix synth's per-channel outputs into the single gain node
		this.synth = synth;
		this.output = out;
	}

	// Idempotent. If the font is already loaded, returns immediately. If a
	// load is in flight for the same key, returns the existing promise so two
	// callers don't double-fetch the same SoundFont blob.
	//
	// `preferDrums` flips the default-preset picker: drum-kit soundfonts often
	// also ship a melodic bank, and the non-drum heuristic would route the
	// channel to that instead of the kit. Callers that know the font is a kit
	// (by category/filename) pass true so the kit's drum preset wins.
	async loadFont(key: string, url: string, preferDrums = false): Promise<void> {
		if (this.fonts.has(key)) return;
		const existing = this.inflightLoads.get(key);
		if (existing) return existing;
		const promise = this.doLoadFont(key, url, preferDrums);
		this.inflightLoads.set(key, promise);
		try {
			await promise;
		} finally {
			// Always clean up — success or failure.
			this.inflightLoads.delete(key);
		}
	}

	// Actual font loading. Allocates a bank offset, adds the bank, waits for
	// the worklet's preset-list-change event, picks a default preset, and
	// then re-applies every channel's intended font (see the big comment in
	// the file header for why).
	private async doLoadFont(key: string, url: string, preferDrums: boolean): Promise<void> {
		const synth = this.synth;
		if (!synth) throw new Error("Engine not initialized");

		const bankOffset = this.nextBankOffset++;
		// Snapshot the existing preset set so we can diff after addSoundBank.
		const before = new Set(synth.presetList.map(presetKey));

		// Register a one-shot listener for the merged preset list update that
		// follows addSoundBank. The worklet posts the new list asynchronously,
		// so awaiting addSoundBank alone isn't enough.
		const listenerId = `loadFont:${key}:${bankOffset}`;
		const presetListPromise = new Promise<readonly { bankMSB: number; bankLSB: number; program: number; isDrum: boolean; name?: string }[]>((resolve) => {
			synth.eventHandler.addEvent("presetListChange", listenerId, (list) => {
				synth.eventHandler.removeEvent("presetListChange", listenerId);
				resolve(list);
			});
		});

		// Fetch the SoundFont binary and hand it off to the worklet.
		const buffer = await (await fetch(url)).arrayBuffer();
		await synth.soundBankManager.addSoundBank(buffer, key, bankOffset);
		// Race a timeout so a missing event doesn't deadlock the load.
		const list = await Promise.race([
			presetListPromise,
			new Promise<typeof synth.presetList>((resolve) => setTimeout(() => resolve(synth.presetList), 1500)),
		]);

		// What did THIS bank add?
		const added = list.filter((p) => !before.has(presetKey(p)));
		// Single-instrument SFs typically expose one preset; pick the first non-drum
		// for melodic banks, otherwise fall back to anything we got. For drum-kit
		// fonts the caller flips preferDrums so the kit's drum preset wins over
		// any incidental melodic bank shipped in the same SF.
		const chosen = preferDrums
			? added.find((p) => p.isDrum) ?? added[0] ?? list[0]
			: added.find((p) => !p.isDrum) ?? added[0] ?? list[0];
		this.fonts.set(key, {
			bankOffset,
			isDrum: chosen?.isDrum ?? false,
			defaultPreset: chosen
				? { bankMSB: chosen.bankMSB, bankLSB: chosen.bankLSB, program: chosen.program, isDrum: chosen.isDrum }
				: { bankMSB: bankOffset, bankLSB: 0, program: 0, isDrum: false }, // safe fallback
		});

		// addSoundBank can shift the bank/program lookup on channels that are
		// already programmed — the worklet rebuilds its preset table and any
		// channel sitting on the now-overridden program ends up playing the
		// new bank's instrument. That's exactly the multiplayer bug where one
		// user changes their soundfont and everyone else's piano starts
		// sounding the same. Fix: invalidate the channel-font cache and
		// re-apply each tracked channel's assigned font so the underlying
		// synth state matches our intent again.
		const prevFontByChannel = new Map(this.channelFont);
		this.channelFont.clear();
		for (const [channel, fontKey] of prevFontByChannel) {
			this.selectFontOnChannel(channel, fontKey);
		}
	}

	hasFont(key: string): boolean {
		return this.fonts.has(key);
	}

	/**
	 * Returns the MIDI channel assigned to `playerId`, allocating one if needed.
	 * SELF always returns channel 0.
	 */
	channelForPlayer(playerId: string, isSelf: boolean): number {
		// Self pins to channel 0 — also record it in the maps so freePlayer logic
		// works uniformly (even though self is never actually freed).
		if (isSelf) {
			if (!this.playerChannels.has(playerId)) {
				this.playerChannels.set(playerId, SELF_CHANNEL);
				this.channelByPlayer.set(SELF_CHANNEL, playerId);
			}
			return SELF_CHANNEL;
		}
		// Already assigned? Return the cached channel.
		const existing = this.playerChannels.get(playerId);
		if (existing !== undefined) return existing;

		// Look for a free slot first.
		// Round-robin from `nextPeerChannel` so consecutive joiners spread out
		// rather than piling onto the lowest available channel.
		for (let i = 0; i < MAX_CHANNELS; i++) {
			const candidate = (this.nextPeerChannel + i) % MAX_CHANNELS;
			if (candidate === SELF_CHANNEL || candidate === DRUM_CHANNEL) continue;
			if (!this.channelByPlayer.has(candidate)) {
				this.playerChannels.set(playerId, candidate);
				this.channelByPlayer.set(candidate, playerId);
				this.nextPeerChannel = (candidate + 1) % MAX_CHANNELS;
				return candidate;
			}
		}

		// All 14 peer channels taken — fall back to sharing channel 1.
		// This is graceful degradation: peers sharing a channel sound identical.
		this.playerChannels.set(playerId, 1);
		return 1;
	}

	/**
	 * Programs a channel to the given font's default preset. No-op if the channel
	 * is already on that font.
	 */
	selectFontOnChannel(channel: number, key: string): boolean {
		if (!this.synth) return false;
		const entry = this.fonts.get(key);
		if (!entry) return false;
		// Cache hit — channel is already on this font. Skipping the
		// bank/program MIDI messages avoids a tiny audible click at every
		// note attack (especially on soundfonts with envelope-sensitive
		// presets). The multiplayer addSoundBank issue that prompted us to
		// briefly remove this check is now fully handled inside doLoadFont
		// by re-applying every tracked channel's font right after the bank
		// is added — see the loop at the end of that function.
		if (this.channelFont.get(channel) === key) return true;
		// Flip drum mode on the channel BEFORE bank/program so the worklet
		// resolves the bank against the drum bank table for drum kits, and
		// the melodic table for everything else. Without this, drum kits
		// other than Standard fail to make sound — the bank-select lands in
		// the melodic side of the worklet's preset map and finds nothing.
		this.synth.midiChannels[channel]?.setDrums(entry.isDrum);
		const { bankMSB, bankLSB, program } = entry.defaultPreset;
		// CC0 = Bank Select MSB, CC32 = Bank Select LSB, then ProgramChange finalizes.
		this.synth.controllerChange(channel, 0, bankMSB);
		this.synth.controllerChange(channel, 32, bankLSB);
		this.synth.programChange(channel, program);
		this.channelFont.set(channel, key);
		return true;
	}

	// Standard MIDI note-on. Velocity is 0–127; 0 is treated as note-off by the spec.
	noteOn(channel: number, midi: number, velocity: number): void {
		this.synth?.noteOn(channel, midi, velocity);
	}

	noteOff(channel: number, midi: number): void {
		this.synth?.noteOff(channel, midi);
	}

	// MIDI CC64 = sustain pedal. Threshold of 64 in the spec; we just use 0/127.
	setSustain(channel: number, on: boolean): void {
		this.synth?.controllerChange(channel, 64, on ? 127 : 0);
	}

	releaseAllOnChannel(channel: number): void {
		// CC120 = all sound off (immediate). CC123 = all notes off (respects sustain).
		// We want immediate cleanup to match the old `releaseAll()` semantics.
		this.synth?.controllerChange(channel, 120, 0);
	}

	/** Releases the peer's channel so it can be reused. SELF is never freed. */
	freePlayer(playerId: string): void {
		const ch = this.playerChannels.get(playerId);
		if (ch === undefined || ch === SELF_CHANNEL) return;
		// Belt-and-braces: drop any hanging notes + sustain before clearing
		// the slot, so a future tenant doesn't inherit stuck state.
		this.releaseAllOnChannel(ch);
		this.setSustain(ch, false);
		this.playerChannels.delete(playerId);
		// Only clear channel→player if THIS player still owns it (peers can share via fallback).
		if (this.channelByPlayer.get(ch) === playerId) {
			this.channelByPlayer.delete(ch);
			this.channelFont.delete(ch);
		}
	}
}
