"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Piano } from "@/components/multiplayer/Piano";
import { Visualizer } from "@/components/multiplayer/Visualizer";
import { Navigation } from "@/components/layout/Navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { updateMyUsername } from "@/lib/friends";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { incrementTotalNotes, checkAndUnlockAchievements } from "@/lib/achievements";
import { AchievementBanner } from "@/components/achievements/AchievementBanner";
import type { Achievement } from "@/lib/achievements";
import { useRecording } from "@/hooks/useRecording";

export default function HomeClient() {
	const [showKeys, setShowKeys] = useState(true);
	const [showHomeScreen, setShowHomeScreen] = useState(true);
	const [username, setUsername] = useState("");
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);
	const [bannerAchievement, setBannerAchievement] = useState<Achievement | null>(null);
	const notesThisSessionRef = useRef(0);
	const { state: recordingState, countdown: recordingCountdown, startRecording, stopRecording } = useRecording(userId);

	const router = useRouter();

	const {
		pianoKeys,
		noteLines,
		playNote,
		stopNote,
		unlockAudio,
		connectMIDI,
		midiDevices,
		midiError,
		soundfonts,
		currentSoundfont,
		loadedSoundfonts,
		loadingSoundfont,
		selectSoundfont,
		masterVolume,
		setMasterVolume,
		noteColor,
		setNoteColor,
		setSustain,
		keyboardInputEnabled,
		setKeyboardInputEnabled,
		keybinds,
		setKeybinds,
		keybindBaseMidi,
		setKeybindBaseMidi,
		keybindPreset,
		setKeybindPreset,
		settings,
		updateSetting,
		resetSettings,
	} = useAudioEngineContext();

	const handleNotePlayed = useCallback(
		(midi: number, vel: number) => {
			unlockAudio();
			playNote(midi, vel, "self");
			notesThisSessionRef.current += 1;
			const total = incrementTotalNotes();
			const newAch = checkAndUnlockAchievements(total);
			if (newAch.length > 0) {
				setBannerAchievement(newAch[0]);
			}
		},
		[playNote, unlockAudio],
	);

	const handleKeyboardPlay = useCallback(
		(midi: number, vel: number) => {
			handleNotePlayed(midi, vel);
		},
		[handleNotePlayed],
	);
	const handleKeyboardStop = useCallback(
		(midi: number) => {
			stopNote(midi, "self");
		},
		[stopNote],
	);

	useKeyboardInput({
		enabled: keyboardInputEnabled && !showHomeScreen,
		keybinds,
		baseMidi: keybindBaseMidi,
		onPlay: handleKeyboardPlay,
		onStop: handleKeyboardStop,
		onOctaveShift: (delta) => setKeybindBaseMidi(keybindBaseMidi + delta),
		onSustainChange: setSustain,
		onAnyKey: unlockAudio,
	});

	useEffect(() => {
		const loadUser = async () => {
			const supabase = createClient();
			const { data } = await supabase.auth.getUser();
			if (data.user) {
				setUserId(data.user.id);
				setIsLoggedIn(true);
				const { data: profile } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
				const name =
					profile?.username ||
					(data.user.user_metadata?.username as string | undefined) ||
					data.user.email?.split("@")[0] ||
					data.user.id.substring(0, 8);
				setUsername(name);
				sessionStorage.setItem(
					"away_user",
					JSON.stringify({ id: data.user.id, email: data.user.email, username: name }),
				);
			}
		};
		loadUser();
	}, []);

	const handleUsernameChange = useCallback(
		(next: string) => {
			setUsername(next);
			if (isLoggedIn) updateMyUsername(next);
			try {
				const saved = sessionStorage.getItem("away_user");
				if (saved) {
					const parsed = JSON.parse(saved);
					sessionStorage.setItem("away_user", JSON.stringify({ ...parsed, username: next }));
				}
			} catch {}
		},
		[isLoggedIn],
	);

	const handleMultiplayerClick = () => router.push("/multiplayer");
	const handleProfileClick = () => router.push("/protected/profile");
	const handleSettingsClick = () => router.push("/settings");

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			{showHomeScreen ? (
				<>
					<SilkBackground color={settings.backgroundColor} scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} animated={backgroundAnimated} />
					<div className="absolute inset-0 z-10">
						<div className="absolute bottom-0 left-0 right-0 h-32"></div>
						<div className="absolute right-30 mt-30">
							<div className="flex flex-col items-end">
								<h1 className="text-[96px] font-black text-white tracking-wider mb-2 title">Away</h1>
								<p
									className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-20"
									onClick={() => {
										setShowHomeScreen(false);
										unlockAudio();
									}}
								>
									Solo mode
								</p>
								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleMultiplayerClick}>
									Multiplayer mode
								</p>
								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleProfileClick}>
									Profile
								</p>
								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleSettingsClick}>
									Settings
								</p>
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<SilkBackground color={settings.backgroundColor} scale={1} noiseIntensity={1.3} speed={3} rotation={270} animated={backgroundAnimated} />
					<div className="absolute inset-0 z-10 flex flex-col">
						<Navigation
							onLogout={() => setShowHomeScreen(true)}
							onToggleRecord={recordingState === "recording" ? stopRecording : startRecording}
							recordingState={recordingState}
							recordingCountdown={recordingCountdown}
							midiDevices={midiDevices}
							midiError={midiError}
							onRetryMidi={() => connectMIDI()}
							soundfonts={soundfonts}
							currentSoundfont={currentSoundfont}
							loadedSoundfonts={loadedSoundfonts}
							loadingSoundfont={loadingSoundfont}
							onSelectSoundfont={selectSoundfont}
							masterVolume={masterVolume}
							onMasterVolumeChange={setMasterVolume}
							username={username}
							onUsernameChange={handleUsernameChange}
							noteColor={noteColor}
							onNoteColorChange={setNoteColor}
							keyboardInputEnabled={keyboardInputEnabled}
							onKeyboardInputEnabledChange={setKeyboardInputEnabled}
							keybinds={keybinds}
							onKeybindsChange={setKeybinds}
							keybindBaseMidi={keybindBaseMidi}
							onKeybindBaseMidiChange={setKeybindBaseMidi}
							keybindPreset={keybindPreset}
							onKeybindPresetChange={setKeybindPreset}
							settings={settings}
							updateSetting={updateSetting}
							onResetSettings={resetSettings}
						/>
						<Visualizer
							noteLines={noteLines}
							enabled={settings.visualizerEnabled}
							fallSpeed={settings.noteFallSpeed}
							cornerRadius={settings.noteCornerRadius}
						/>
						<Piano
							pianoKeys={pianoKeys}
							showKeys={showKeys}
							onPlayNote={handleNotePlayed}
							onStopNote={stopNote}
							showNoteLabels={settings.showNoteLabels}
							keyAnimations={settings.keyAnimations}
						/>
						{bannerAchievement && (
							<AchievementBanner
								achievement={bannerAchievement}
								onDismiss={() => setBannerAchievement(null)}
							/>
						)}
					</div>
				</>
			)}
		</div>
	);
}
