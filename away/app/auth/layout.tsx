"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full w-full text-gray-200 overflow-hidden flex relative">
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
			<BackButton />
			<div className="absolute inset-0 z-10 flex items-center justify-center p-6">{children}</div>
		</div>
	);
}
