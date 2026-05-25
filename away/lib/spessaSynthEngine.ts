import { WorkletSynthesizer } from "spessasynth_lib";

// Public path of the AudioWorklet processor. Copied at install time by
// scripts/sync-spessasynth-worklet.mjs from node_modules/spessasynth_lib/dist.
const WORKLET_URL = "/spessasynth/spessasynth_processor.min.js";

// Channel reserved for the local player. Peers start at 1.
export const SELF_CHANNEL = 0;
const MAX_CHANNELS = 16;
const DRUM_CHANNEL = 9; // MIDI convention; we skip it for melodic fonts.

type PresetAddress = {
	bankMSB: number;
	bankLSB: number;
	program: number;
	isDrum: boolean;
};

type FontEntry = {
	/** The offset passed to addSoundBank. Same value lives in the resulting bankMSB of merged presets. */
	bankOffset: number;
	/** The preset we'll auto-select when this font is targeted on a channel. */
	defaultPreset: PresetAddress;
};

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

	private readonly fonts = new Map<string, FontEntry>();
	private readonly inflightLoads = new Map<string, Promise<void>>();
	private nextBankOffset = 0;

	private readonly playerChannels = new Map<string, number>();
	private readonly channelByPlayer = new Map<number, string>();
	/** Next channel slot to try when allocating a new peer. */
	private nextPeerChannel = 1;

	/** Currently-selected font on each channel — used to avoid redundant program changes. */
	private readonly channelFont = new Map<number, string>();

	get ready(): boolean {
		return this.synth !== null && this.output !== null;
	}

	async init(ctx: AudioContext): Promise<void> {
		if (this.synth) return;
		await ctx.audioWorklet.addModule(WORKLET_URL);
		const synth = new WorkletSynthesizer(ctx);
		await synth.isReady;
		const out = ctx.createGain();
		synth.connect(out);
		this.synth = synth;
		this.output = out;
	}

	async loadFont(key: string, url: string): Promise<void> {
		if (this.fonts.has(key)) return;
		const existing = this.inflightLoads.get(key);
		if (existing) return existing;
		const promise = this.doLoadFont(key, url);
		this.inflightLoads.set(key, promise);
		try {
			await promise;
		} finally {
			this.inflightLoads.delete(key);
		}
	}

	private async doLoadFont(key: string, url: string): Promise<void> {
		const synth = this.synth;
		if (!synth) throw new Error("Engine not initialized");

		const bankOffset = this.nextBankOffset++;
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

		const buffer = await (await fetch(url)).arrayBuffer();
		await synth.soundBankManager.addSoundBank(buffer, key, bankOffset);
		// Race a timeout so a missing event doesn't deadlock the load.
		const list = await Promise.race([
			presetListPromise,
			new Promise<typeof synth.presetList>((resolve) => setTimeout(() => resolve(synth.presetList), 1500)),
		]);

		const added = list.filter((p) => !before.has(presetKey(p)));
		// Single-instrument SFs typically expose one preset; pick the first non-drum
		// for melodic banks, otherwise fall back to anything we got.
		const chosen = added.find((p) => !p.isDrum) ?? added[0] ?? list[0];
		this.fonts.set(key, {
			bankOffset,
			defaultPreset: chosen
				? { bankMSB: chosen.bankMSB, bankLSB: chosen.bankLSB, program: chosen.program, isDrum: chosen.isDrum }
				: { bankMSB: bankOffset, bankLSB: 0, program: 0, isDrum: false },
		});
	}

	hasFont(key: string): boolean {
		return this.fonts.has(key);
	}

	/**
	 * Returns the MIDI channel assigned to `playerId`, allocating one if needed.
	 * SELF always returns channel 0.
	 */
	channelForPlayer(playerId: string, isSelf: boolean): number {
		if (isSelf) {
			if (!this.playerChannels.has(playerId)) {
				this.playerChannels.set(playerId, SELF_CHANNEL);
				this.channelByPlayer.set(SELF_CHANNEL, playerId);
			}
			return SELF_CHANNEL;
		}
		const existing = this.playerChannels.get(playerId);
		if (existing !== undefined) return existing;

		// Look for a free slot first.
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
		if (this.channelFont.get(channel) === key) return true;
		const { bankMSB, bankLSB, program } = entry.defaultPreset;
		// CC0 = Bank Select MSB, CC32 = Bank Select LSB, then ProgramChange finalizes.
		this.synth.controllerChange(channel, 0, bankMSB);
		this.synth.controllerChange(channel, 32, bankLSB);
		this.synth.programChange(channel, program);
		this.channelFont.set(channel, key);
		return true;
	}

	noteOn(channel: number, midi: number, velocity: number): void {
		this.synth?.noteOn(channel, midi, velocity);
	}

	noteOff(channel: number, midi: number): void {
		this.synth?.noteOff(channel, midi);
	}

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
