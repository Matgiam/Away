"use client";

import { useAppRouter } from "@/hooks/useAppRouter";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";

export default function SettingsPage() {
	const router = useAppRouter();
	const {
		masterVolume,
		setMasterVolume,
		midiDevices,
		midiError,
		connectMIDI,
		noteColor,
		setNoteColor,
		settings,
		updateSetting,
		resetSettings,
		keyboardInputEnabled,
		setKeyboardInputEnabled,
		keybinds,
		setKeybinds,
		keybindBaseMidi,
		setKeybindBaseMidi,
		keybindPreset,
		setKeybindPreset,
		soundfonts,
		currentSoundfont,
		loadedSoundfonts,
		loadingSoundfont,
		selectSoundfont,
	} = useAudioEngineContext();

	const myName = typeof window !== "undefined"
		? (() => {
			try {
				const saved = sessionStorage.getItem("away_user");
				if (saved) {
					const parsed = JSON.parse(saved);
					return parsed.username || parsed.email?.split("@")[0] || "";
				}
			} catch {}
			return "";
		})()
		: "";

	const handleUsernameChange = (next: string) => {
		try {
			const saved = sessionStorage.getItem("away_user");
			if (saved) {
				const parsed = JSON.parse(saved);
				sessionStorage.setItem("away_user", JSON.stringify({ ...parsed, username: next }));
			}
		} catch {}
	};

	const handleRetryMidi = () => {
		// Use the engine's default handlers (playNote / stopNote / setSustain)
		// — without them the device list refreshes but pressing a MIDI key
		// after refresh does nothing because the registered listeners are
		// no-ops, which is the "Refresh button doesn't work" bug users hit on
		// the dedicated settings page (the in-app SettingsPanel works because
		// its host page passes defaults).
		connectMIDI();
	};

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-full w-full text-gray-200 overflow-hidden relative">
			<SilkBackground color={settings.backgroundColor} scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} animated={backgroundAnimated} />
			<BackButton />
			<SettingsPanel
				open={true}
				onClose={() => router.push("/")}
				masterVolume={masterVolume}
				onMasterVolumeChange={setMasterVolume}
				username={myName}
				onUsernameChange={handleUsernameChange}
				onResetAll={resetSettings}
				midiDevices={midiDevices}
				midiError={midiError}
				onRetryMidi={handleRetryMidi}
				keyboardInputEnabled={keyboardInputEnabled}
				onKeyboardInputEnabledChange={setKeyboardInputEnabled}
				keybinds={keybinds}
				onKeybindsChange={setKeybinds}
				keybindBaseMidi={keybindBaseMidi}
				onKeybindBaseMidiChange={setKeybindBaseMidi}
				keybindPreset={keybindPreset}
				onKeybindPresetChange={setKeybindPreset}
				noteColor={noteColor}
				onNoteColorChange={setNoteColor}
				settings={settings}
				updateSetting={updateSetting}
			/>
		</div>
	);
}
