import React from "react";
import { Settings, Piano, Music, Volume2 } from "lucide-react";
import { DynamicLiquidGlass } from "./DynamicLiquidglass";

export const Navigation = ({ onLogout }: { onLogout?: () => void }) => {
	return (
		<>
			{/* ADDED zIndex: 50 to bring this to the front */}
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center">
					<DynamicLiquidGlass width={250} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none">Yamaha S90ES</h1>
					</DynamicLiquidGlass>
				</div>
			</div>

			{/* ADDED zIndex: 50 to bring this to the front */}
			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				<div className="flex gap-6 items-center">
					<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001} blur={2}>
						<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
							<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
							<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" />
						</svg>
					</DynamicLiquidGlass>

					<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<img src="/icons/Wrench.svg" alt="Icon 1" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
					</DynamicLiquidGlass>

					{/* Wrapped the button safely */}
					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
							<img src="/icons/Logout.svg" alt="Icon 2" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>
				</div>
			</div>
		</>
	);
};
