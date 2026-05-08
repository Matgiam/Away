"use client";

import React, { useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SoundfontOption } from "@/hooks/useAudioEngine";

interface NavigationProps {
	onLogout?: () => void;
	isChatOpen?: boolean;
	onToggleChat?: () => void;
	chatAnchorRef?: React.RefObject<HTMLDivElement | null>;
	midiDevices?: string[];
	midiError?: string | null;
	onRetryMidi?: () => void;
	soundfonts?: SoundfontOption[];
	currentSoundfont?: string;
	loadedSoundfonts?: string[];
	loadingSoundfont?: string | null;
	onSelectSoundfont?: (key: string) => void;
	onToggleRecord?: () => void;
	isRecording?: boolean;
}

export const Navigation = ({
	onLogout,
	isChatOpen,
	onToggleChat,
	chatAnchorRef,
	midiDevices = [],
	midiError = null,
	onRetryMidi,
	soundfonts = [],
	currentSoundfont,
	loadedSoundfonts = [],
	loadingSoundfont = null,
	onSelectSoundfont,
	onToggleRecord,
	isRecording = false,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);

	const currentName =
		soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";

	const openSettings = () => {
		setShowSettings(true);
		onRetryMidi?.();
	};
	const closeSettings = () => setShowSettings(false);

	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center">
					<DynamicLiquidGlass
						width={290}
						height={60}
						radius={15}
						refractionLevel={0.8}
						specularOpacity={0.7}
						glassBgOpacity={0.001}
					>
						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none truncate px-3">
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
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="51"
								height="51"
								viewBox="0 0 51 51"
								fill="none"
							>
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
							<img
								src="/icons/Wrench.svg"
								alt="Settings"
								style={{ width: "35px", height: "35px", objectFit: "contain" }}
							/>
						</DynamicLiquidGlass>
					</div>

					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={0.001}
						>
							<img
								src="/icons/Logout.svg"
								alt="Logout"
								style={{ width: "35px", height: "35px", objectFit: "contain" }}
							/>
						</DynamicLiquidGlass>
					</div>
				</div>

				{onToggleChat && !isChatOpen && (
					<div onClick={onToggleChat} className="cursor-pointer relative mt-5">
						<DynamicLiquidGlass
							width={160}
							height={60}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isChatOpen ? 0.15 : 0.001}
						>
							<div className="w-full h-full text-xl flex items-center justify-center text-white gap-2">
								Open chat
								<img src="/icons/message.svg" alt="" />
							</div>
						</DynamicLiquidGlass>
					</div>
				)}

				<div ref={chatAnchorRef} style={{ height: 0 }} />
			</div>

			{showSettings && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
					onClick={closeSettings}
				>
					<div
						onClick={(e) => e.stopPropagation()}
						className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
					>
						<div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
							<h2 className="text-white text-lg font-semibold italic">Settings</h2>
							<button
								onClick={closeSettings}
								className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white"
								aria-label="Close"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
							<section>
								<div className="flex items-center justify-between mb-3">
									<span className="text-white/60 text-xs uppercase tracking-widest font-medium">
										MIDI Inputs
									</span>
									<button
										onClick={() => onRetryMidi?.()}
										className="text-white/60 hover:text-white text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
									>
										Refresh
									</button>
								</div>

								{midiError && (
									<div className="mb-3 text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed">
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
												className="flex items-center gap-2 text-white text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2"
											>
												<span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
												<span className="truncate">{d}</span>
											</li>
										))}
									</ul>
								)}

								<p className="mt-2 text-[10px] text-white/30 leading-relaxed">
									Brave: enable MIDI at brave://settings/content/midiSysex and reload.
								</p>
							</section>

							<section className="pt-5 border-t border-white/10">
								<div className="flex items-center justify-between mb-3">
									<span className="text-white/60 text-xs uppercase tracking-widest font-medium">
										Soundfonts
									</span>
								</div>
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
										const action = isActive
											? "Active"
											: isLoading
												? "Loading…"
												: isLoaded
													? "Use"
													: "Load";

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
							</section>
						</div>
					</div>
				</div>
			)}
		</>
	);
};