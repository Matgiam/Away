"use client";

import { useCallback, useEffect, useState } from "react";
import {
	PIANO_ACTIONS,
	CONTROL_ACTIONS,
	PRESETS,
	codeToDisplay,
	MIN_BASE_MIDI,
	MAX_BASE_MIDI,
	type ActionId,
	type Keybinds,
	type LayoutPreset,
} from "@/lib/keybinds";

interface KeybindConfigProps {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	keybinds: Keybinds;
	onKeybindsChange: (binds: Keybinds) => void;
	baseMidi: number;
	onBaseMidiChange: (midi: number) => void;
	activePreset: LayoutPreset | null;
	onActivePresetChange: (preset: LayoutPreset | null) => void;
}

const SECTIONS: { title: string; actions: readonly { id: ActionId; label: string }[] }[] = [
	{ title: "Lower octave", actions: PIANO_ACTIONS.slice(0, 12) as unknown as { id: ActionId; label: string }[] },
	{ title: "Upper octave", actions: PIANO_ACTIONS.slice(12, 24) as unknown as { id: ActionId; label: string }[] },
	{ title: "Controls", actions: CONTROL_ACTIONS as unknown as { id: ActionId; label: string }[] },
];

const MIDI_NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
function midiToName(midi: number): string {
	return `${MIDI_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

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

export const KeybindConfig = ({
	enabled,
	onEnabledChange,
	keybinds,
	onKeybindsChange,
	baseMidi,
	onBaseMidiChange,
	activePreset,
	onActivePresetChange,
}: KeybindConfigProps) => {
	const [listeningFor, setListeningFor] = useState<ActionId | null>(null);

	const usedBy = useCallback(
		(code: string) => {
			const out: ActionId[] = [];
			(Object.keys(keybinds) as ActionId[]).forEach((id) => {
				if (keybinds[id] === code) out.push(id);
			});
			return out;
		},
		[keybinds],
	);

	useEffect(() => {
		if (!listeningFor) return;
		const handler = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.code === "Escape") {
				setListeningFor(null);
				return;
			}

			const target = listeningFor;
			const conflicts = usedBy(e.code).filter((id) => id !== target);
			const next: Keybinds = { ...keybinds };
			conflicts.forEach((id) => {
				next[id] = null;
			});
			next[target] = e.code;
			onKeybindsChange(next);
			onActivePresetChange(null);
			setListeningFor(null);
		};
		const opts: AddEventListenerOptions = { capture: true };
		window.addEventListener("keydown", handler, opts);
		return () => window.removeEventListener("keydown", handler, opts);
	}, [listeningFor, keybinds, onKeybindsChange, onActivePresetChange, usedBy]);

	const applyPreset = (preset: LayoutPreset) => {
		onKeybindsChange({ ...PRESETS[preset] });
		onActivePresetChange(preset);
		setListeningFor(null);
	};

	const clearBinding = (id: ActionId) => {
		onKeybindsChange({ ...keybinds, [id]: null });
		onActivePresetChange(null);
	};

	return (
		<div className="flex flex-col gap-6 max-w-2xl pt-4 pb-6">
			<div className="flex items-center justify-between">
				<div>
					<label className="text-white text-lg italic">Play piano with keyboard</label>
					<p className="text-white/40 text-xs mt-1 leading-relaxed">
						Use your laptop keyboard to play piano notes when no MIDI device is connected.
					</p>
				</div>
				<Toggle value={enabled} onChange={onEnabledChange} />
			</div>

			<div className="flex flex-col gap-3">
				<span className="text-white/60 text-xs uppercase tracking-widest font-medium">Layout preset</span>
				<div className="flex gap-3">
					{(["qwerty", "azerty"] as const).map((preset) => {
						const isActive = activePreset === preset;
						return (
							<button
								key={preset}
								onClick={() => applyPreset(preset)}
								className={`flex-1 px-5 py-3 rounded-xl border italic transition-colors ${
									isActive
										? "bg-purple-500/20 border-purple-400/50 text-white"
										: "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
								}`}
							>
								<span className="uppercase tracking-wider text-sm font-medium not-italic">
									{preset}
								</span>
								<span className="block text-[10px] text-white/40 mt-1 not-italic">
									{preset === "qwerty" ? "Standard US/UK layout" : "French / Belgian layout"}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex items-center gap-4">
				<label className="text-white text-sm italic whitespace-nowrap">
					Starting note <span className="font-bold not-italic ml-2">{midiToName(baseMidi)}</span>
				</label>
				<input
					type="range"
					min={MIN_BASE_MIDI}
					max={MAX_BASE_MIDI}
					step={12}
					value={baseMidi}
					onChange={(e) => onBaseMidiChange(Number(e.target.value))}
					className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
				/>
			</div>

			<div className="flex flex-col gap-6">
				{SECTIONS.map((section) => (
					<div key={section.title} className="flex flex-col gap-2">
						<span className="text-white/60 text-xs uppercase tracking-widest font-medium">{section.title}</span>
						<div className="flex flex-col">
							{section.actions.map((action) => {
								const code = keybinds[action.id];
								const isListening = listeningFor === action.id;
								const display = isListening ? "Press a key…" : codeToDisplay(code);
								return (
									<div
										key={action.id}
										className="flex items-center justify-between gap-4 py-2.5 border-b border-white/5 last:border-b-0"
									>
										<span className="text-white/80 text-sm uppercase tracking-wider">
											{action.label}
										</span>
										<div className="flex items-center gap-2">
											<button
												onClick={() => setListeningFor(action.id)}
												className={`min-w-[110px] px-4 py-2 rounded-md border text-sm transition-colors text-center ${
													isListening
														? "bg-purple-500/30 border-purple-400/60 text-white animate-pulse"
														: code
															? "bg-white/5 border-white/15 text-white hover:bg-white/10"
															: "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
												}`}
											>
												{display}
											</button>
											{code && !isListening && (
												<button
													onClick={() => clearBinding(action.id)}
													className="w-8 h-8 flex items-center justify-center rounded-md text-white/30 hover:text-white hover:bg-white/10"
													aria-label="Clear binding"
													title="Clear binding"
												>
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
														<path d="M18 6L6 18M6 6l12 12" />
													</svg>
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>

			<p className="text-[10px] text-white/30 leading-relaxed">
				Click a binding to rebind. Press <span className="text-white/50">Esc</span> while listening to cancel.
			</p>
		</div>
	);
};
