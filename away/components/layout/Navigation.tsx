"use client";

import React, { useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SoundfontOption } from "@/hooks/useAudioEngine";
import { SoundfontPanel } from "@/components/layout/SoundfontPanel";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import type { Keybinds, LayoutPreset } from "@/lib/keybinds";
import type { AppSettings } from "@/lib/settings";

interface NavigationProps {
	onLogout?: () => void;
	isChatOpen?: boolean;
	onToggleChat?: () => void;
	unreadChatCount?: number;
	chatAnchorRef?: React.RefObject<HTMLDivElement | null>;
	midiDevices?: string[];
	midiError?: string | null;
	onRetryMidi?: () => void;
	soundfonts?: SoundfontOption[];
	currentSoundfont?: string;
	loadedSoundfonts?: string[];
	loadingSoundfont?: string | null;
	onSelectSoundfont?: (key: string) => void;
	masterVolume?: number;
	onMasterVolumeChange?: (v: number) => void;
	username?: string;
	onUsernameChange?: (name: string) => void;
	onToggleRecord?: () => void;
	isRecording?: boolean;
	recordingState?: "idle" | "countdown" | "recording";
	recordingCountdown?: number;
	noteColor?: string;
	onNoteColorChange?: (hex: string) => void;
	keyboardInputEnabled?: boolean;
	onKeyboardInputEnabledChange?: (enabled: boolean) => void;
	keybinds?: Keybinds;
	onKeybindsChange?: (binds: Keybinds) => void;
	keybindBaseMidi?: number;
	onKeybindBaseMidiChange?: (midi: number) => void;
	keybindPreset?: LayoutPreset | null;
	onKeybindPresetChange?: (preset: LayoutPreset | null) => void;
	settings?: AppSettings;
	updateSetting?: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
	onResetSettings?: () => void;
}

export const Navigation = ({
	onLogout,
	isChatOpen,
	onToggleChat,
	unreadChatCount = 0,
	chatAnchorRef,
	midiDevices = [],
	midiError = null,
	onRetryMidi,
	soundfonts = [],
	currentSoundfont,
	loadedSoundfonts = [],
	loadingSoundfont = null,
	onSelectSoundfont,
	masterVolume = 75,
	onMasterVolumeChange,
	username = "",
	onUsernameChange,
	onToggleRecord,
	isRecording = false,
	recordingState = "idle",
	recordingCountdown = 0,
	noteColor = "#db5361",
	onNoteColorChange,
	keyboardInputEnabled = true,
	onKeyboardInputEnabledChange,
	keybinds,
	onKeybindsChange,
	keybindBaseMidi = 60,
	onKeybindBaseMidiChange,
	keybindPreset = null,
	onKeybindPresetChange,
	settings,
	updateSetting,
	onResetSettings,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);
	const [showSoundfontPanel, setShowSoundfontPanel] = useState(false);

	const currentName = soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";

	const openSettings = () => {
		setShowSettings(true);
		onRetryMidi?.();
	};
	const openSoundfontPanel = () => setShowSoundfontPanel(true);
	const closeSettings = () => setShowSettings(false);
	const closeSoundfontPanel = () => setShowSoundfontPanel(false);

	const canRenderSettings =
		!!settings &&
		!!updateSetting &&
		!!keybinds &&
		!!onKeybindsChange &&
		!!onMasterVolumeChange &&
		!!onUsernameChange &&
		!!onRetryMidi &&
		!!onKeyboardInputEnabledChange &&
		!!onKeybindBaseMidiChange &&
		!!onKeybindPresetChange &&
		!!onNoteColorChange &&
		!!onResetSettings;

	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center cursor-pointer" onClick={openSoundfontPanel} title="Choose soundfont">
					<DynamicLiquidGlass width={250} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<h1
							className="text-white font-semibold tracking-wide text-lg pointer-events-none truncate block px-3 text-center"
							style={{ maxWidth: "230px" }}
						>
							{loadingSoundfont === currentSoundfont ? "Loading…" : currentName}
						</h1>
					</DynamicLiquidGlass>
				</div>
			</div>

			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				<div className="flex gap-6 items-center">
					<div onClick={onToggleRecord} className="cursor-pointer relative" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={recordingState === "recording" ? 0.2 : 0.001}
							blur={2}
						>
							{recordingState === "recording" ? (
								<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#AA0000">
									<rect x="6" y="6" width="12" height="12" rx="2" />
								</svg>
							) : (
								<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
									<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
									<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" />
								</svg>
							)}
						</DynamicLiquidGlass>
						{recordingState === "countdown" && (
							<span className="absolute -inset-1 flex items-center justify-center text-white text-lg font-bold">
								{recordingCountdown > 0 ? recordingCountdown : "GO"}
							</span>
						)}
					</div>

					<div onClick={openSettings} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={showSettings ? 0.15 : 0.001}
						>
							<img src="/icons/Wrench.svg" alt="Settings" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>

					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
							<img src="/icons/Logout.svg" alt="Logout" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>
				</div>

				{onToggleChat && !isChatOpen && (
					<div onClick={onToggleChat} className="cursor-pointer relative mt-5 inline-block">
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isChatOpen ? 0.15 : 0.001}
						>
							<img src="/icons/message.svg" alt="Chat" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
						{unreadChatCount > 0 && settings?.chatNotifications !== false && (
							<span
								className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600/85 text-white/90 text-[10px] font-medium flex items-center justify-center border border-white/15 pointer-events-none"
								aria-label={`${unreadChatCount} unread messages`}
							>
								{unreadChatCount > 9 ? "9+" : unreadChatCount}
							</span>
						)}
					</div>
				)}

				<div ref={chatAnchorRef} style={{ height: 0 }} />
			</div>

			<SoundfontPanel
				open={showSoundfontPanel}
				onClose={closeSoundfontPanel}
				soundfonts={soundfonts}
				currentSoundfont={currentSoundfont}
				loadedSoundfonts={loadedSoundfonts}
				loadingSoundfont={loadingSoundfont}
				onSelectSoundfont={onSelectSoundfont}
			/>

			{canRenderSettings && (
				<SettingsPanel
					open={showSettings}
					onClose={closeSettings}
					masterVolume={masterVolume}
					onMasterVolumeChange={onMasterVolumeChange!}
					username={username}
					onUsernameChange={onUsernameChange!}
					onResetAll={onResetSettings!}
					midiDevices={midiDevices}
					midiError={midiError}
					onRetryMidi={onRetryMidi!}
					keyboardInputEnabled={keyboardInputEnabled}
					onKeyboardInputEnabledChange={onKeyboardInputEnabledChange!}
					keybinds={keybinds!}
					onKeybindsChange={onKeybindsChange!}
					keybindBaseMidi={keybindBaseMidi}
					onKeybindBaseMidiChange={onKeybindBaseMidiChange!}
					keybindPreset={keybindPreset}
					onKeybindPresetChange={onKeybindPresetChange!}
					noteColor={noteColor}
					onNoteColorChange={onNoteColorChange!}
					settings={settings!}
					updateSetting={updateSetting!}
				/>
			)}
		</>
	);
};
