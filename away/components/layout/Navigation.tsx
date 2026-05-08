"use client";

import React, { useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface NavigationProps {
	onLogout?: () => void;
	isChatOpen?: boolean;
	onToggleChat?: () => void;
	chatAnchorRef?: React.RefObject<HTMLDivElement | null>;
	midiDevices?: string[];
	midiError?: string | null;
	onRetryMidi?: () => void;
}

export const Navigation = ({
	onLogout,
	isChatOpen,
	onToggleChat,
	chatAnchorRef,
	midiDevices = [],
	midiError = null,
	onRetryMidi,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);

	const primaryDevice = midiDevices[0] || "No MIDI device";

	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center">
					<DynamicLiquidGlass width={250} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none truncate px-3">{primaryDevice}</h1>
					</DynamicLiquidGlass>
				</div>
			</div>

			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				<div className="flex gap-6 items-center">
					<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001} blur={2}>
						<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
							<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
							<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill={midiDevices.length > 0 ? "#22aa55" : "#AA0000"} />
						</svg>
					</DynamicLiquidGlass>

					<div
						onClick={() => {
							setShowSettings((s) => !s);
							if (!showSettings) onRetryMidi?.();
						}}
						className="cursor-pointer"
						style={{ pointerEvents: "auto" }}
					>
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

				{showSettings && (
					<div
						className="mt-4 rounded-2xl border border-white/10 bg-[#0d0620]/95 backdrop-blur-xl shadow-2xl p-5"
						style={{ width: 320, pointerEvents: "auto" }}
					>
						<div className="flex items-center justify-between mb-3">
							<span className="text-white/60 text-xs uppercase tracking-widest font-medium">MIDI Settings</span>
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
							<p className="text-white/40 text-sm">No MIDI devices detected. Plug in your keyboard via USB and click Refresh.</p>
						)}

						{midiDevices.length > 0 && (
							<>
								<p className="text-white/40 text-xs mb-2">Connected inputs</p>
								<ul className="space-y-2">
									{midiDevices.map((d, i) => (
										<li
											key={`${d}-${i}`}
											className="flex items-center gap-2 text-white text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2"
										>
											<span className="w-2 h-2 rounded-full bg-green-400" />
											<span className="truncate">{d}</span>
										</li>
									))}
								</ul>
							</>
						)}

						<p className="mt-4 text-[10px] text-white/30 leading-relaxed">
							Brave users: if no devices appear, enable MIDI at brave://settings/content/midiSysex and reload this page.
						</p>
					</div>
				)}

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
		</>
	);
};
