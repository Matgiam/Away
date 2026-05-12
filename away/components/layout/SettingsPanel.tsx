"use client";

import { useEffect, useState } from "react";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { KeybindConfig } from "@/components/layout/KeybindConfig";
import type { AppSettings } from "@/lib/settings";
import type { Keybinds, LayoutPreset } from "@/lib/keybinds";

type TabKey = "General" | "Audio" | "MIDI" | "Keyboard" | "Visualisation" | "Multiplayer" ;

const TABS: TabKey[] = ["General", "Audio", "MIDI", "Keyboard", "Visualisation", "Multiplayer"];

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

							<SectionHeader>Recording</SectionHeader>
							<SettingRow
								label="Auto-download recordings"
								hint="When you stop a recording, save it to your downloads automatically."
							>
								<Toggle
									value={settings.autoDownloadRecording}
									onChange={(v) => updateSetting("autoDownloadRecording", v)}
								/>
							</SettingRow>
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
							<div className="pt-1">
								<ColorPicker value={noteColor} onChange={onNoteColorChange} />
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
						</div>
					)}

					{activeTab === "Multiplayer" && (
						<div className="flex flex-col gap-4 max-w-2xl pt-4 pb-8">
							<SectionHeader>Visuals</SectionHeader>
							<SettingRow
								label="Show other players' note colors"
								hint="Off uses your own note color for every player's notes."
							>
								<Toggle
									value={settings.showPlayerColors}
									onChange={(v) => updateSetting("showPlayerColors", v)}
								/>
							</SettingRow>
							<SettingRow
								label="Show player names"
								hint="Label notes with the player who triggered them."
							>
								<Toggle
									value={settings.showPlayerNames}
									onChange={(v) => updateSetting("showPlayerNames", v)}
								/>
							</SettingRow>

							<SectionHeader>Chat</SectionHeader>
							<SettingRow
								label="In-app notifications"
								hint="Show a badge counter when chat messages arrive while you're playing."
							>
								<Toggle
									value={settings.chatNotifications}
									onChange={(v) => updateSetting("chatNotifications", v)}
								/>
							</SettingRow>
							<SettingRow
								label="Notification sound"
								hint="Play a soft chime for incoming messages."
							>
								<Toggle
									value={settings.chatSoundEnabled}
									onChange={(v) => updateSetting("chatSoundEnabled", v)}
								/>
							</SettingRow>

							<SectionHeader>Rooms</SectionHeader>
							<SettingRow
								label="Confirm before leaving room"
								hint="Ask before navigating away from a jam room."
							>
								<Toggle
									value={settings.confirmLeaveRoom}
									onChange={(v) => updateSetting("confirmLeaveRoom", v)}
								/>
							</SettingRow>
						</div>
					)}

				
				</div>
			</div>
		</div>
	);
};
