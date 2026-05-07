import React from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface NavigationProps {
	onLogout?: () => void;
	isChatOpen?: boolean;
	onToggleChat?: () => void;
	chatAnchorRef?: React.RefObject<HTMLDivElement>;
}

export const Navigation = ({ onLogout, isChatOpen, onToggleChat, chatAnchorRef }: NavigationProps) => {
	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center">
					<DynamicLiquidGlass width={250} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none">Yamaha S90ES</h1>
					</DynamicLiquidGlass>
				</div>
			</div>

			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				<div className="flex gap-6 items-center">
					<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001} blur={2}>
						<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
							<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
							<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" />
						</svg>
					</DynamicLiquidGlass>

					<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<img src="/icons/Wrench.svg" alt="Settings" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
					</DynamicLiquidGlass>

					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
							<img src="/icons/Logout.svg" alt="Logout" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>
				</div>

				{onToggleChat && !isChatOpen && (
					<div onClick={onToggleChat} className="cursor-pointer relative mt-5">
						<DynamicLiquidGlass
							width={160}
							height={60}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isChatOpen ? 0.15 : 0.001}
						>
							<div className="w-full h-full text-xl flex items-center justify-center text-white gap-2">
								Open chat
								<img src="/icons/message.svg" alt="" />
							</div>
						</DynamicLiquidGlass>
					</div>
				)}

		
				<div ref={chatAnchorRef} style={{ height: 0 }} />
			</div>
		</>
	);
};
