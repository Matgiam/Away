"use client";

import React, { useRef, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SoundfontOption } from "@/hooks/useAudioEngine";
import { useResponsiveNavSize } from "@/hooks/useResponsiveNavSize";
import { SoundfontPanel } from "@/components/layout/SoundfontPanel";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { MetronomePopover } from "@/components/layout/MetronomePopover";
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
	onSaveNoteColor?: () => void;
	noteColorDirty?: boolean;
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
	// Hide the metronome button (used on the multiplayer page where it doesn't make sense)
	hideMetronome?: boolean;
	// Optional 67×67 buttons to slot into the right-side grid. The first two
	// items land on the metronome row (to the left of the metronome). Anything
	// beyond that flows into additional rows of 3. Each entry must be a single
	// element so the grid can place it as one cell.
	extraControls?: React.ReactNode[];
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
	onSaveNoteColor,
	noteColorDirty,
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
	hideMetronome = false,
	extraControls,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);
	const [showSoundfontPanel, setShowSoundfontPanel] = useState(false);
	const [showMetronome, setShowMetronome] = useState(false);
	const [metronomeRect, setMetronomeRect] = useState<DOMRect | null>(null);
	const metronomeAnchorRef = useRef<HTMLDivElement | null>(null);

	// All hardcoded sizes (67×67 buttons, 250×60 pill, 20px gap) now flow from
	// this hook so the nav scales with viewport instead of staying fixed.
	const navSize = useResponsiveNavSize();

	const currentName = soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";

	const openSettings = () => {
		setShowSettings(true);
		onRetryMidi?.();
	};
	const openSoundfontPanel = () => setShowSoundfontPanel(true);
	const closeSettings = () => setShowSettings(false);
	const closeSoundfontPanel = () => setShowSoundfontPanel(false);
	const toggleMetronomePopover = () => {
		if (showMetronome) {
			setShowMetronome(false);
			return;
		}
		if (metronomeAnchorRef.current) {
			setMetronomeRect(metronomeAnchorRef.current.getBoundingClientRect());
		}
		setShowMetronome(true);
	};
	const closeMetronome = () => setShowMetronome(false);

	// Plain click on the metronome icon: flip on/off directly — quick and obvious.
	// Right-click (or shift/alt-click): open the popover for BPM / beats / volume tweaks.
	const handleMetronomeClick = (e: React.MouseEvent) => {
		if (e.shiftKey || e.altKey) {
			toggleMetronomePopover();
			return;
		}
		if (!settings || !updateSetting) return;
		updateSetting("metronomeEnabled", !metronomeEnabled);
	};
	const handleMetronomeContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		toggleMetronomePopover();
	};

	const metronomeEnabled = settings?.metronomeEnabled ?? false;
	const metronomeBpm = settings?.metronomeBpm ?? 100;
	const metronomeBeatsPerBar = settings?.metronomeBeatsPerBar ?? 4;
	const metronomeVolume = settings?.metronomeVolume ?? 60;
	const canControlMetronome =
		!!settings && !!updateSetting && !hideMetronome && settings.metronomeVisible;

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
				<div
					className="flex flex-col items-center cursor-pointer transition-transform duration-150 ease-out hover:scale-105"
					onClick={openSoundfontPanel}
					title="Choose soundfont"
				>
					<DynamicLiquidGlass width={navSize.pillWidth} height={navSize.pillHeight} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<div className="flex items-center justify-center gap-2 pointer-events-none px-3" style={{ maxWidth: navSize.pillWidth - 20 }}>
							<h1 className="text-white font-semibold tracking-wide text-lg truncate">
								{loadingSoundfont === currentSoundfont ? "Loading…" : currentName}
							</h1>
							{/* Down chevron — universal "this opens a panel" hint */}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="white"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 opacity-70"
								aria-hidden
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</div>
					</DynamicLiquidGlass>
				</div>
			</div>

			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				{(() => {
					const extras = extraControls ?? [];
					// First two extras share the metronome row; the rest cascade below.
					const inMetronomeRow = extras.slice(0, 2);
					const belowMetronome = extras.slice(2);
					const showMetronomeRow = canControlMetronome || inMetronomeRow.length > 0;
					const recordCell = (
						<div
							onClick={onToggleRecord}
							className="cursor-pointer relative transition-transform duration-150 ease-out hover:scale-105"
							style={{ pointerEvents: "auto" }}
						>
							<DynamicLiquidGlass
								width={navSize.button}
								height={navSize.button}
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
					);
					const wrenchCell = (
						<div
							onClick={openSettings}
							className="cursor-pointer transition-transform duration-150 ease-out hover:scale-105"
							style={{ pointerEvents: "auto" }}
						>
							<DynamicLiquidGlass
								width={navSize.button}
								height={navSize.button}
								radius={15}
								refractionLevel={0.8}
								specularOpacity={0.7}
								glassBgOpacity={showSettings ? 0.15 : 0.001}
							>
								<GearIcon size={Math.round(navSize.button * 0.52)} />
							</DynamicLiquidGlass>
						</div>
					);
					const exitCell = (
						<div
							onClick={onLogout}
							className="cursor-pointer transition-transform duration-150 ease-out hover:scale-105"
							style={{ pointerEvents: "auto" }}
						>
							<DynamicLiquidGlass width={navSize.button} height={navSize.button} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
								<img src="/icons/Logout.svg" alt="Logout" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
							</DynamicLiquidGlass>
						</div>
					);
					const metronomeCell = canControlMetronome ? (
						<div
							ref={metronomeAnchorRef}
							onClick={handleMetronomeClick}
							onContextMenu={handleMetronomeContextMenu}
							className="cursor-pointer relative transition-transform duration-150 ease-out hover:scale-105"
							style={{ pointerEvents: "auto" }}
							title={`Metronome — click to ${metronomeEnabled ? "mute" : "play"} · right-click for BPM`}
						>
							<DynamicLiquidGlass
								width={navSize.button}
								height={navSize.button}
								radius={15}
								refractionLevel={0.8}
								specularOpacity={0.7}
								glassBgOpacity={metronomeEnabled || showMetronome ? 0.15 : 0.001}
							>
								<MetronomeIcon active={metronomeEnabled} />
							</DynamicLiquidGlass>
							{metronomeEnabled && (
								<span
									className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c75ad6] shadow-[0_0_8px_rgba(199,90,214,0.8)] pointer-events-none"
									aria-hidden
								/>
							)}
						</div>
					) : (
						// Empty grid cell so the metronome column stays visually aligned
						// when the metronome itself is hidden but the parent provided
						// extras to slot into the same row.
						<div style={{ width: navSize.button, height: navSize.button }} aria-hidden />
					);

					return (
						<div className="grid grid-cols-3 justify-items-end" style={{ gap: navSize.gap }}>
							{recordCell}
							{wrenchCell}
							{exitCell}

							{showMetronomeRow && (
								<>
									{inMetronomeRow[0] ?? <div style={{ width: navSize.button, height: navSize.button }} aria-hidden />}
									{inMetronomeRow[1] ?? <div style={{ width: navSize.button, height: navSize.button }} aria-hidden />}
									{metronomeCell}
								</>
							)}

							{belowMetronome.map((node, i) => (
								<div key={i} className="contents">
									{node}
								</div>
							))}
						</div>
					);
				})()}

				{onToggleChat && !isChatOpen && (
					<div
						onClick={onToggleChat}
						className="cursor-pointer relative inline-block transition-transform duration-150 ease-out hover:scale-105"
						style={{ marginTop: navSize.gap }}
					>
						<DynamicLiquidGlass
							width={navSize.button}
							height={navSize.button}
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

			{canControlMetronome && (
				<MetronomePopover
					open={showMetronome}
					onClose={closeMetronome}
					anchorRect={metronomeRect}
					enabled={metronomeEnabled}
					onEnabledChange={(v) => updateSetting!("metronomeEnabled", v)}
					bpm={metronomeBpm}
					onBpmChange={(v) => updateSetting!("metronomeBpm", v)}
					beatsPerBar={metronomeBeatsPerBar}
					onBeatsPerBarChange={(v) => updateSetting!("metronomeBeatsPerBar", v)}
					volume={metronomeVolume}
					onVolumeChange={(v) => updateSetting!("metronomeVolume", v)}
				/>
			)}

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
					onSaveNoteColor={onSaveNoteColor}
					noteColorDirty={noteColorDirty}
					settings={settings!}
					updateSetting={updateSetting!}
				/>
			)}
		</>
	);
};

function MetronomeIcon({ active }: { active: boolean }) {
	const stroke = active ? "#ffffff" : "#cfcfcf";
	return (
		<svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			{/* Pyramid body */}
			<path
				d="M9.4 3.5 L14.6 3.5 L18 20.5 L6 20.5 Z"
				stroke={stroke}
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
			{/* Base */}
			<path d="M5 20.5 H19" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
			{/* Window */}
			<path
				d="M10 7.5 H14"
				stroke={stroke}
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
			{/* Pendulum — leans right when active to suggest motion */}
			<line
				x1="12"
				y1="18"
				x2={active ? "15.5" : "12"}
				y2="6"
				stroke={active ? "#c75ad6" : stroke}
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="18" r="1.3" fill={stroke} />
		</svg>
	);
}

// Gear / cog icon for the Settings button. 6 rounded teeth around a central
// hole — Tabler-style silhouette that reads as "settings" at any size. The
// `size` prop scales it proportionally to the responsive nav button.
function GearIcon({ size }: { size: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="white"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-label="Settings"
			role="img"
		>
			{/* Toothed outer body — 6 teeth at 60° intervals. Each tooth peak
			    is offset radially from the gear's body. Drawn as a single
			    closed path centered on (12, 12). */}
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			{/* Central hole */}
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}
