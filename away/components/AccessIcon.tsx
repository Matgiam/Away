import type { Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "./DynamicLiquidglass";

interface AccessIconProps {
	type: Accessibility;
	glass?: boolean;
}

export function AccessIcon({ type, glass = true }: AccessIconProps) {
	const iconClass = "w-10 h-6";

	const publicIcon = <img src="/icons/globe.svg" alt="" className={iconClass} />;

	const privateIcon = <img src="/icons/lock.svg" alt="" className={iconClass} />;

	const friendsIcon = <img src="/icons/friends.svg" alt="" className={iconClass} />;
	const icon = type === "public" ? publicIcon : type === "private" ? privateIcon : friendsIcon;

	if (!glass) return icon;

	return (
		<DynamicLiquidGlass width={85} height={69} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
			{icon}
		</DynamicLiquidGlass>
	);
}
