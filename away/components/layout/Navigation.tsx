"use client";

import React, { useState, useEffect } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SoundfontOption } from "@/hooks/useAudioEngine";
import { ColorPicker } from "@/components/ui/ColorPicker";

type TabKey = "General" | "MIDI" | "Keyboard" | "Visualisation";

const TABS: TabKey[] = ["General", "MIDI", "Keyboard", "Visualisation"];

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
	noteColor?: string;
	onNoteColorChange?: (hex: string) => void;
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
		onClick={() => onChange(!value)}
		className={`relative w-14 h-7 rounded-full transition-colors ${value ? "bg-purple-500" : "bg-white/10 border border-white/15"}`}
	>
		<span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${value ? "translate-x-7" : "translate-x-0.5"}`} />
	</button>
);

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
	noteColor = "#db5361",
	onNoteColorChange,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);
	const [activeTab, setActiveTab] = useState<TabKey>("General");
	const [usernameDraft, setUsernameDraft] = useState(username);
	const [invisibleMode, setInvisibleMode] = useState(false);

	useEffect(() => {
		setUsernameDraft(username);
	}, [username]);

	const currentName = soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";

	const openSettings = () => {
		setShowSettings(true);
		onRetryMidi?.();
	};
	const openKeyboardSettings = () => {
		setActiveTab("Keyboard");
		setShowSettings(true);
	};
	const closeSettings = () => setShowSettings(false);

	const handleApplyUsername = () => {
		const trimmed = usernameDraft.trim();
		if (trimmed && trimmed !== username) onUsernameChange?.(trimmed);
	};

	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center cursor-pointer" onClick={openKeyboardSettings} title="Change soundfont">
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
					<div onClick={onToggleRecord} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isRecording ? 0.2 : 0.001}
							blur={2}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
								<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
								<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" />
							</svg>
						</DynamicLiquidGlass>
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
							<img
								src="/icons/message.svg"
								alt="Chat"
								style={{ width: "35px", height: "35px", objectFit: "contain" }}
							/>
						</DynamicLiquidGlass>
						{unreadChatCount > 0 && (
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

			{showSettings && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pb-40" onClick={closeSettings}>
					<div
						onClick={(e) => e.stopPropagation()}
						className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex "
						style={{ height: "80vh", maxHeight: "650px" }}
					>
						<aside className="w-64 shrink-0 border-r border-white/10 px-8 py-10 flex flex-col">
							<h2 className="text-white text-4xl font-light italic mb-14">Settings</h2>
							<nav className="flex flex-col gap-5">
								{TABS.map((tab) => (
									<button
										key={tab}
										onClick={() => setActiveTab(tab)}
										className={`text-xl italic text-left transition-colors ${
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
								onClick={closeSettings}
								className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
								aria-label="Close"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>

							{activeTab === "General" && (
								<div className="flex flex-col gap-10 max-w-2xl pt-4">
									<div className="flex items-center gap-5">
										<label className="text-white text-lg italic whitespace-nowrap">
											Master volume <span className="font-bold not-italic ml-2">{masterVolume}%</span>
										</label>
										<SpeakerIcon muted={masterVolume === 0} />
										<input
											type="range"
											min={0}
											max={100}
											value={masterVolume}
											onChange={(e) => onMasterVolumeChange?.(Number(e.target.value))}
											className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
										/>
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

									<div className="flex items-center justify-between pt-2">
										<label className="text-white text-lg italic">Invisible mode</label>
										<Toggle value={invisibleMode} onChange={setInvisibleMode} />
									</div>
								</div>
							)}

							{activeTab === "MIDI" && (
								<div className="flex flex-col gap-4 max-w-2xl pt-4">
									<div className="flex items-center justify-between">
										<span className="text-white/60 text-xs uppercase tracking-widest font-medium">MIDI Inputs</span>
										<button
											onClick={() => onRetryMidi?.()}
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
										<p className="text-white/40 text-sm">No MIDI devices detected. Plug in your keyboard via USB and click Refresh.</p>
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

									<p className="text-[10px] text-white/30 leading-relaxed mt-2">
										Brave: enable MIDI at brave://settings/content/midiSysex and reload.
									</p>
								</div>
							)}

							{activeTab === "Keyboard" && (
								<div className="flex flex-col gap-3 max-w-2xl pt-4">
									<span className="text-white/60 text-xs uppercase tracking-widest font-medium mb-1">Soundfont</span>
									<ul className="space-y-2">
										{soundfonts.map((sf) => {
											const isActive = sf.key === currentSoundfont;
											const isLoaded = loadedSoundfonts.includes(sf.key);
											const isLoading = loadingSoundfont === sf.key;
											const dotClass = isActive
												? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
												: isLoaded
													? "bg-blue-400"
													: isLoading
														? "bg-yellow-400 animate-pulse"
														: "bg-white/20";
											const action = isActive ? "Active" : isLoading ? "Loading…" : isLoaded ? "Use" : "Load";

											return (
												<li key={sf.key}>
													<button
														onClick={() => onSelectSoundfont?.(sf.key)}
														disabled={isActive || isLoading}
														className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors ${
															isActive
																? "bg-white/10 border-white/25 text-white cursor-default"
																: "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
														} disabled:cursor-not-allowed`}
													>
														<div className="flex items-center gap-3 min-w-0">
															<span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
															<span className="text-sm truncate">{sf.name}</span>
														</div>
														<span
															className={`text-xs font-medium px-2 py-1 rounded ${
																isActive
																	? "bg-green-500/20 text-green-300"
																	: isLoading
																		? "bg-yellow-500/20 text-yellow-300"
																		: isLoaded
																			? "bg-blue-500/20 text-blue-300"
																			: "bg-white/10 text-white/60"
															}`}
														>
															{action}
														</span>
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							)}

							{activeTab === "Visualisation" && (
								<div className="flex flex-col gap-4 max-w-2xl pt-4">
									<span className="text-white/60 text-xs uppercase tracking-widest font-medium">Note color</span>
									<p className="text-white/40 text-xs leading-relaxed">
										Pick any color for white-key notes — black-key notes use the same color a shade darker.
									</p>
									<div className="pt-1">
										<ColorPicker value={noteColor} onChange={(hex) => onNoteColorChange?.(hex)} />
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};
