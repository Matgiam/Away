// ============================================================================
// ui/AccessIcon.tsx
// ----------------------------------------------------------------------------
// Visual badge for a room's access type — Public / Private / Friends — shown
// on lobby cards and the create-room modal.
//
// Renders the matching icon (globe / lock / friends) plus an optional label,
// optionally wrapped in the DynamicLiquidGlass effect that tints up on hover.
// ============================================================================

import { useState } from "react";
import type { Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface AccessIconProps {
	type: "public" | "private" | "friends";
	glass?: boolean;
	text?: boolean;
	// Highlight this icon as the currently-selected filter. Brightens the
	// label, icon, and glass tint so the active category stands out from
	// the others in the row.
	active?: boolean;
}

export function AccessIcon({ type, glass = true, text = true, active = false }: AccessIconProps) {
	const [isHovered, setIsHovered] = useState(false);

	const iconClass = `w-10 h-6 transition-opacity ${active ? "opacity-100" : "opacity-70"}`;
	const icons: Record<"public" | "private" | "friends", any> = {
		public: <img src="/icons/globe.svg" alt="" className={iconClass} />,
		private: <img src="/icons/lock.svg" alt="" className={iconClass} />,
		friends: <img src="/icons/friends.svg" alt="" className={iconClass} />,
	};

	const content = (
		<div className="flex flex-col items-center gap-2">
			{icons[type]}
			<span
				className={`text-[10px] uppercase tracking-wider transition-colors ${
					active ? "font-semibold text-white" : "font-medium text-white/70"
				}`}
			>
				{type}
			</span>
		</div>
	);
	const noText = <div className="flex flex-col items-center">{icons[type]}</div>;

	if (!text && !glass) return noText;

	const glassBgOpacity = active ? 0.08 : isHovered ? 0.05 : 0.001;

	return (
		<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="cursor-pointer">
			<DynamicLiquidGlass width={85} height={80} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={glassBgOpacity}>
				<div className="w-full h-full flex items-center justify-center">{content}</div>
			</DynamicLiquidGlass>
		</div>
	);
}
