import { useState } from "react"; // 1. Import useState
import type { Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "./DynamicLiquidglass";

interface AccessIconProps {
	type: "public" | "private" | "friends";
	glass?: boolean;
	text?: boolean;
}

export function AccessIcon({ type, glass = true, text = true }: AccessIconProps) {
	const [isHovered, setIsHovered] = useState(false);

	const iconClass = "w-10 h-6";
	const icons: Record<"public" | "private" | "friends", any> = {
		public: <img src="/icons/globe.svg" alt="" className={iconClass} />,
		private: <img src="/icons/lock.svg" alt="" className={iconClass} />,
		friends: <img src="/icons/friends.svg" alt="" className={iconClass} />,
	};

	const content = (
		<div className="flex flex-col items-center gap-2">
			{icons[type]}
			<span className="text-[10px] uppercase tracking-wider font-medium text-white/70">{type}</span>
		</div>
	);
	const noText = <div className="flex flex-col items-center">{icons[type]}</div>;

	if (!text && !glass) return noText;

	return (
		<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="cursor-pointer">
			<DynamicLiquidGlass width={85} height={80} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={isHovered ? 0.15 : 0.001}>
				<div className="w-full h-full flex items-center justify-center">{content}</div>
			</DynamicLiquidGlass>
		</div>
	);
}
