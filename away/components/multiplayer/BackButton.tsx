"use client";

import { useRouter } from "next/navigation";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { useState } from "react";

export default function BackButton() {
	const router = useRouter();
	const [isHovered, setIsHovered] = useState(false);
	return (
		<button onClick={() => router.push("/")}>
			<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="absolute top-5 left-5 cursor-pointer z-150 hover:scale-110 transition-transform">
				<DynamicLiquidGlass width={87} height={51} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={isHovered ? 0.05 : 0.001}>
					<img src="/icons/arrow.svg" alt="Icon 1" style={{ width: "35px", height: "30px", objectFit: "contain" }} />
				</DynamicLiquidGlass>
			</div>
		</button>
	);
}
