"use client";

import { useEffect, useRef, useState } from "react";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { KeybindConfig } from "@/components/layout/KeybindConfig";
import { BadgedUsername } from "@/components/achievements/BadgedUsername";
import type { AppSettings, AudioLatency } from "@/lib/settings";
import type { Keybinds, LayoutPreset } from "@/lib/keybinds";

type TabKey = "General" | "Audio" | "MIDI" | "Keyboard" | "Visualisation";

const TABS: TabKey[] = ["General", "Audio", "MIDI", "Keyboard", "Visualisation"];

const BACKGROUND_PRESETS: { label: string; value: string }[] = [
	{ label: "Midnight (default)", value: "#0b0416" },
	{ label: "Indigo", value: "#0a0524" },
	{ label: "Crimson", value: "#1a0408" },
	{ label: "Forest", value: "#04140a" },
	{ label: "Ocean", value: "#04101a" },
	{ label: "Sunset", value: "#1a0a04" },
	{ label: "Slate", value: "#0c0c10" },
	{ label: "Pure black", value: "#000000" },
];

export interface SettingsPanelProps {
	open: boolean;
	onClose: () => void;

	// general
	masterVolume: number;
	onMasterVolumeChange: (v: number) => void;
	username: string;
	onUsernameChange: (name: string) => void;
	onResetAll: () => void;

	// midi
	midiDevices: string[];
	midiError: string | null;
	onRetryMidi: () => void;

	// keyboard / keybinds
	keyboardInputEnabled: boolean;
	onKeyboardInputEnabledChange: (enabled: boolean) => void;
	keybinds: Keybinds;
	onKeybindsChange: (binds: Keybinds) => void;
	keybindBaseMidi: number;
	onKeybindBaseMidiChange: (midi: number) => void;
	keybindPreset: LayoutPreset | null;
	onKeybindPresetChange: (preset: LayoutPreset | null) => void;

	// visualisation
	noteColor: string;
	onNoteColorChange: (hex: string) => void;
	// When provided, the color picker shows a Save button that commits and
	// broadcasts the color to peers in the current room. Without this, color
	// changes apply locally only (e.g. on the home page outside multiplayer).
	onSaveNoteColor?: () => void;
	noteColorDirty?: boolean;

	// app settings
	settings: AppSettings;
	updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const SpeakerIcon = ({ muted }: { muted?: boolean }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white/70">
		<path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
		{!muted && (
			<>
				<path d="M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" />
				<path d="M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" />
			</>
		)}
	</svg>
);

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
	<button
		type="button"
		role="switch"
		aria-checked={value}
		onClick={() => onChange(!value)}
		className={`relative w-14 h-7 rounded-full transition-colors shrink-0 p-0 border-0 cursor-pointer ${
			value ? "bg-purple-500" : "bg-white/10 ring-1 ring-inset ring-white/15"
		}`}
	>
		<span
			className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out ${
				value ? "left-7" : "left-0.5"
			}`}
		/>
	</button>
);

const Slider = ({
	value,
	min,
	max,
	step = 1,
	onChange,
}: {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
}) => (
	<input
		type="range"
		min={min}
		max={max}
		step={step}
		value={value}
		onChange={(e) => onChange(Number(e.target.value))}
		className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
	/>
);

const SettingRow = ({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) => (
	<div className="flex items-center justify-between gap-5 py-2">
		<div className="flex flex-col">
			<label className="text-white text-base italic">{label}</label>
			{hint && <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-md">{hint}</p>}
		</div>
		<div className="flex items-center gap-3 shrink-0">{children}</div>
	</div>
);

const SettingFull = ({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) => (
	<div className="flex flex-col gap-2 py-2">
		<div className="flex flex-col">
			<label className="text-white text-base italic">{label}</label>
			{hint && <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-md">{hint}</p>}
		</div>
		<div className="flex items-center gap-3">{children}</div>
	</div>
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
	<span className="text-white/60 text-xs uppercase tracking-widest font-medium mb-1">{children}</span>
);

const SegmentedControl = <T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (v: T) => void;
}) => (
	<div className="inline-flex rounded-lg border border-white/10 bg-white/5 overflow-hidden">
		{options.map((opt) => (
			<button
				key={opt.value}
				onClick={() => onChange(opt.value)}
				className={`px-4 py-2 text-sm transition-colors ${
					value === opt.value
						? "bg-purple-500/30 text-white"
						: "text-white/60 hover:bg-white/5 hover:text-white"
				}`}
			>
				{opt.label}
			</button>
		))}
	</div>
);

// Special row for the audio latency setting. The AudioContext was constructed
// at boot with whatever value was in localStorage then — changing the setting
// later only takes effect on the next page reload. We snapshot the boot value
// the first time this component mounts and show a "Reload to apply" chip
// whenever the live setting differs from it.
const AudioLatencyRow = ({
	value,
	onChange,
}: {
	value: AudioLatency;
	onChange: (v: AudioLatency) => void;
}) => {
	const bootValueRef = useRef<AudioLatency>(value);
	useEffect(() => {
		bootValueRef.current = value;
		// Only fire once on mount; subsequent renders compare against the snapshot.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const needsReload = value !== bootValueRef.current;

	return (
		<SettingRow
			label="Audio latency"
			hint="Lower = more responsive but higher chance of cracks/clicks on slow CPUs. Stable adds a small delay to keep playback smooth. Try Balanced or Stable if you hear crackling."
		>
			<div className="flex items-center gap-3">
				<SegmentedControl
					value={value}
					options={[
						{ value: "low", label: "Low" },
						{ value: "balanced", label: "Balanced" },
						{ value: "stable", label: "Stable" },
					]}
					onChange={onChange}
				/>
				{needsReload && (
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="text-[10px] uppercase tracking-widest text-amber-300/90 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 rounded-md px-2.5 py-1 transition-colors"
						title="Reload the page to apply the new audio latency"
					>
						Reload to apply
					</button>
				)}
			</div>
		</SettingRow>
	);
};

export const SettingsPanel = ({
	open,
	onClose,
	masterVolume,
	onMasterVolumeChange,
	username,
	onUsernameChange,
	onResetAll,
	midiDevices,
	midiError,
	onRetryMidi,
	keyboardInputEnabled,
	onKeyboardInputEnabledChange,
	keybinds,
	onKeybindsChange,
	keybindBaseMidi,
	onKeybindBaseMidiChange,
	keybindPreset,
	onKeybindPresetChange,
	noteColor,
	onNoteColorChange,
	onSaveNoteColor,
	noteColorDirty,
	settings,
	updateSetting,
}: SettingsPanelProps) => {
	const [activeTab, setActiveTab] = useState<TabKey>("General");
	const [usernameDraft, setUsernameDraft] = useState(username);
	const [confirmReset, setConfirmReset] = useState(false);

	useEffect(() => {
		setUsernameDraft(username);
	}, [username]);

	if (!open) return null;

	const handleApplyUsername = () => {
		const trimmed = usernameDraft.trim();
		if (trimmed && trimmed !== username) onUsernameChange(trimmed);
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pb-40" onClick={onClose}>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex"
				style={{ height: "80vh", maxHeight: "650px" }}
			>
				<aside className="w-64 shrink-0 border-r border-white/10 px-8 py-10 flex flex-col">
					<h2 className="text-white text-4xl font-light italic mb-10">Settings</h2>
					<nav className="flex flex-col gap-4">
						{TABS.map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`text-lg italic text-left transition-colors ${
									activeTab === tab ? "text-white font-medium" : "text-white/30 hover:text-white/60"
								}`}
							>
								{tab}
							</button>
						))}
					</nav>
				</aside>

				<div className="flex-1 px-12 py-10 overflow-y-auto relative">
					<button
						onClick={onClose}
						className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
						aria-label="Close"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>

					{activeTab === "General" && (
						<div className="flex flex-col gap-4 max-w-2xl pt-4 pb-8">
							<SectionHeader>Profile</SectionHeader>
							<div className="flex items-center gap-3 text-white text-base italic">
								<BadgedUsername username={username} />
							</div>
							<div className="flex items-center gap-4">
								<input
									type="text"
									value={usernameDraft}
									onChange={(e) => setUsernameDraft(e.target.value)}
									placeholder="Username"
									className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white italic outline-none focus:border-white/25 transition-colors"
								/>
								<button
									onClick={handleApplyUsername}
									className="px-5 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white italic hover:bg-white/10 transition-colors whitespace-nowrap"
								>
									Change username
								</button>
							</div>

							<SectionHeader>Audio</SectionHeader>
							<SettingFull label={`Master volume — ${masterVolume}%`}>
								<SpeakerIcon muted={masterVolume === 0} />
								<Slider value={masterVolume} min={0} max={100} onChange={onMasterVolumeChange} />
							</SettingFull>

							<SectionHeader>Practice</SectionHeader>
							<SettingRow
								label="Metronome"
								hint="Show the metronome icon in the navigation bar."
							>
								<Toggle
									value={settings.metronomeVisible}
									onChange={(v) => {
										updateSetting("metronomeVisible", v);
										// Turning visibility off also silences the metronome — having
										// it tick with no way to stop it would be confusing.
										if (!v) updateSetting("metronomeEnabled", false);
									}}
								/>
							</SettingRow>

							<SectionHeader>Accessibility</SectionHeader>
							<SettingRow
								label="Reduced motion"
								hint="Disable animations across the app for a calmer experience."
							>
								<Toggle
									value={settings.reducedMotion}
									onChange={(v) => updateSetting("reducedMotion", v)}
								/>
							</SettingRow>
							<SettingRow
								label="Animated background"
								hint="Disable to save GPU on lower-end hardware."
							>
								<Toggle
									value={settings.backgroundAnimated}
									onChange={(v) => updateSetting("backgroundAnimated", v)}
								/>
							</SettingRow>

							<SectionHeader>Diagnostics</SectionHeader>
							<SettingRow
								label="Show network latency"
								hint="Display your current ping to the backend (ms) in the bottom-left corner."
							>
								<Toggle
									value={settings.showLatency}
									onChange={(v) => updateSetting("showLatency", v)}
								/>
							</SettingRow>

							<SectionHeader>Danger zone</SectionHeader>
							<SettingRow
								label="Reset all settings"
								hint="Restore every setting on this device to its default. Cannot be undone."
							>
								{confirmReset ? (
									<div className="flex gap-2">
										<button
											onClick={() => {
												onResetAll();
												setConfirmReset(false);
											}}
											className="px-4 py-2 rounded-lg border border-red-400/40 bg-red-500/20 text-red-200 text-sm hover:bg-red-500/30"
										>
											Confirm reset
										</button>
										<button
											onClick={() => setConfirmReset(false)}
											className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white/70 text-sm hover:bg-white/10"
										>
											Cancel
										</button>
									</div>
								) : (
									<button
										onClick={() => setConfirmReset(true)}
										className="px-4 py-2 rounded-lg border border-red-400/30 bg-red-500/10 text-red-200/90 text-sm hover:bg-red-500/20"
									>
										Reset…
									</button>
								)}
							</SettingRow>
						</div>
					)}

					{activeTab === "Audio" && (
						<div className="flex flex-col gap-4 max-w-2xl pt-4 pb-8">
							<SectionHeader>Mix</SectionHeader>
							<SettingFull label={`Reverb — ${settings.reverbWet}%`} hint="Add space to your sound. Subtle by default.">
								<Slider value={settings.reverbWet} min={0} max={100} onChange={(v) => updateSetting("reverbWet", v)} />
							</SettingFull>

							<SectionHeader>Velocity</SectionHeader>
							<SettingRow
								label="Velocity sensitivity"
								hint="Dynamic uses the strength of each MIDI keypress. Fixed plays every note at the same loudness."
							>
								<SegmentedControl
									value={settings.velocityMode}
									options={[
										{ value: "dynamic", label: "Dynamic" },
										{ value: "fixed", label: "Fixed" },
									]}
									onChange={(v) => updateSetting("velocityMode", v)}
								/>
							</SettingRow>
							{settings.velocityMode === "fixed" && (
								<SettingFull label={`Fixed velocity — ${settings.fixedVelocity}`}>
									<Slider value={settings.fixedVelocity} min={1} max={127} onChange={(v) => updateSetting("fixedVelocity", v)} />
								</SettingFull>
							)}

							<SectionHeader>Sustain pedal</SectionHeader>
							<SettingRow
								label="Sustain mode"
								hint="MIDI follows your hardware sustain pedal. Always-on keeps every note ringing. Off disables sustain entirely."
							>
								<SegmentedControl
									value={settings.sustainMode}
									options={[
										{ value: "midi", label: "MIDI" },
										{ value: "always", label: "Always" },
										{ value: "off", label: "Off" },
									]}
									onChange={(v) => updateSetting("sustainMode", v)}
								/>
							</SettingRow>

							<SectionHeader>Performance</SectionHeader>
							<AudioLatencyRow
								value={settings.audioLatency}
								onChange={(v) => updateSetting("audioLatency", v)}
							/>
						</div>
					)}

					{activeTab === "MIDI" && (
						<div className="flex flex-col gap-4 max-w-2xl pt-4 pb-8">
							<div className="flex items-center justify-between">
								<SectionHeader>MIDI Inputs</SectionHeader>
								<button
									onClick={onRetryMidi}
									className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
								>
									Refresh
								</button>
							</div>

							{midiError && (
								<div className="text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed">
									{midiError}
								</div>
							)}

							{midiDevices.length === 0 && !midiError && (
								<p className="text-white/40 text-sm">
									No MIDI devices detected. Plug in your keyboard via USB and click Refresh.
								</p>
							)}

							{midiDevices.length > 0 && (
								<ul className="space-y-2">
									{midiDevices.map((d, i) => (
										<li
											key={`${d}-${i}`}
											className="flex items-center gap-3 text-white text-sm bg-white/5 border border-white/10 rounded-lg px-4 py-3"
										>
											<span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
											<span className="truncate">{d}</span>
										</li>
									))}
								</ul>
							)}

							<SectionHeader>Input</SectionHeader>
							<SettingFull
								label={`Global transpose — ${settings.globalTranspose > 0 ? "+" : ""}${settings.globalTranspose} semitones`}
								hint="Shift every incoming MIDI note up or down. Useful for matching your hardware to the song."
							>
								<Slider value={settings.globalTranspose} min={-12} max={12} onChange={(v) => updateSetting("globalTranspose", v)} />
							</SettingFull>

							<p className="text-[10px] text-white/30 leading-relaxed mt-2">
								Brave: enable MIDI at brave://settings/content/midiSysex and reload.
							</p>
						</div>
					)}

					{activeTab === "Keyboard" && (
						<KeybindConfig
							enabled={keyboardInputEnabled}
							onEnabledChange={onKeyboardInputEnabledChange}
							keybinds={keybinds}
							onKeybindsChange={onKeybindsChange}
							baseMidi={keybindBaseMidi}
							onBaseMidiChange={onKeybindBaseMidiChange}
							activePreset={keybindPreset}
							onActivePresetChange={onKeybindPresetChange}
						/>
					)}

					{activeTab === "Visualisation" && (
						<div className="flex flex-col gap-4 max-w-2xl pt-4 pb-8">
							<SectionHeader>Note color</SectionHeader>
							<p className="text-white/40 text-xs leading-relaxed">
								Pick any color for white-key notes — black-key notes use the same color a shade darker.
							</p>
							<div className="pt-1 flex flex-col gap-3">
								<ColorPicker value={noteColor} onChange={onNoteColorChange} />
								{onSaveNoteColor && (
									<button
										type="button"
										onClick={onSaveNoteColor}
										disabled={!noteColorDirty}
										className={`self-start px-4 py-2 rounded-lg text-sm italic transition-colors ${
											noteColorDirty
												? "bg-purple-500/30 text-white hover:bg-purple-500/40 border border-purple-400/40"
												: "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
										}`}
									>
										{noteColorDirty ? "Save & share with room" : "Saved"}
									</button>
								)}
							</div>

							<SectionHeader>Background color</SectionHeader>
							<p className="text-white/40 text-xs leading-relaxed">
								Choose any color for the animated silk background.
							</p>
							<div className="flex flex-wrap gap-2 pt-1">
								{BACKGROUND_PRESETS.map((preset) => {
									const isActive = preset.value.toLowerCase() === settings.backgroundColor.toLowerCase();
									return (
										<button
											key={preset.value}
											onClick={() => updateSetting("backgroundColor", preset.value)}
											className={`w-9 h-9 rounded-full border transition-all ${
												isActive ? "border-white scale-110" : "border-white/15 hover:border-white/40"
											}`}
											style={{ backgroundColor: preset.value }}
											title={preset.label}
											aria-label={preset.label}
										/>
									);
								})}
							</div>
							<div className="pt-1">
								<ColorPicker
									value={settings.backgroundColor}
									onChange={(hex) => updateSetting("backgroundColor", hex)}
								/>
							</div>

							<SectionHeader>Visualizer</SectionHeader>
							<SettingRow
								label="Show falling notes"
								hint="Disable to hide the visualizer canvas."
							>
								<Toggle
									value={settings.visualizerEnabled}
									onChange={(v) => updateSetting("visualizerEnabled", v)}
								/>
							</SettingRow>
							<SettingFull label={`Fall speed — ${settings.noteFallSpeed}`}>
								<Slider value={settings.noteFallSpeed} min={5} max={120} onChange={(v) => updateSetting("noteFallSpeed", v)} />
							</SettingFull>
							<SettingFull label={`Corner radius — ${settings.noteCornerRadius}px`}>
								<Slider value={settings.noteCornerRadius} min={0} max={16} onChange={(v) => updateSetting("noteCornerRadius", v)} />
							</SettingFull>

							<SectionHeader>Piano</SectionHeader>
							<SettingRow
								label="Show note labels"
								hint="Display C, D, E… on each white key."
							>
								<Toggle
									value={settings.showNoteLabels}
									onChange={(v) => updateSetting("showNoteLabels", v)}
								/>
							</SettingRow>
							<SettingRow
								label="Key press animation"
								hint="Slight key-tilt animation when notes are played."
							>
								<Toggle
									value={settings.keyAnimations}
									onChange={(v) => updateSetting("keyAnimations", v)}
								/>
							</SettingRow>

							<SectionHeader>Chord recognizer</SectionHeader>
							<SettingRow
								label="Show chord names"
								hint="Live-detect triads, 7ths, extensions and inversions from the notes you hold. Displayed above the piano."
							>
								<Toggle
									value={settings.chordRecognizerEnabled}
									onChange={(v) => updateSetting("chordRecognizerEnabled", v)}
								/>
							</SettingRow>
						</div>
					)}

				</div>
			</div>
		</div>
	);
};
