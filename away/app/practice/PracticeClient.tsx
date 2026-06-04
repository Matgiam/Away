"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { PracticeMenu } from "@/components/practice/PracticeMenu";
import type { BuiltInSong } from "@/lib/practice/songs";

interface PracticeClientProps {
	initialSongs: BuiltInSong[];
}

export default function PracticeClient({ initialSongs }: PracticeClientProps) {
	const { settings } = useAudioEngineContext();
	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-[var(--app-h,100dvh)] w-screen bg-[#050505] text-gray-200 overflow-hidden relative">
			<SilkBackground
				color={settings.backgroundColor}
				scale={0.8}
				noiseIntensity={1.3}
				speed={3}
				rotation={180}
				animated={backgroundAnimated}
			/>
			<BackButton />
			<div className="absolute inset-0">
				<PracticeMenu initialSongs={initialSongs} />
			</div>
		</div>
	);
}
