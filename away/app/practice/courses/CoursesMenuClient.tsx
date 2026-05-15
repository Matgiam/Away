"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { CoursesMenu } from "@/components/courses/CoursesMenu";
import type { Course } from "@/lib/courses/types";

interface CoursesMenuClientProps {
	courses: Course[];
}

export default function CoursesMenuClient({ courses }: CoursesMenuClientProps) {
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
			<div className="absolute inset-0 z-10">
				<CoursesMenu courses={courses} />
			</div>
		</div>
	);
}
