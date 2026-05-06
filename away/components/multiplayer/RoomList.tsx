import { AccessIcon } from "@/components/ui/AccessIcon";
import type { Room, Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { useState } from "react";

interface RoomListProps {
	filter: Accessibility;
	setFilter: (filter: Accessibility) => void;
	filteredRooms: Room[];
	setShowCreate: (show: boolean) => void;
	handleJoinRoom: (room: Room) => void;
}

export default function RoomList({ filter, setFilter, filteredRooms, setShowCreate, handleJoinRoom }: RoomListProps) {
	const [isHovered, setIsHovered] = useState(false);
	return (
		<div className="flex flex-col items-center justify-center px-8">
			<div className="w-full max-w-5xl flex items-center justify-between mb-25">
				<button onClick={() => setShowCreate(true)}>
					<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
						<DynamicLiquidGlass
							width={198}
							height={69}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isHovered ? 0.15 : 0.001}
						>
							<div className="w-full h-full text-xl flex items-center justify-center text-white">Create Room</div>
						</DynamicLiquidGlass>
					</div>
				</button>

				<div className="flex gap-2">
					{(["public", "private", "friends"] as const).map((type) => (
						<button key={type} onClick={() => setFilter(type)} className="hover:opacity-80 transition-opacity">
							<AccessIcon type={type} />
						</button>
					))}
				</div>
			</div>
			<div
				className="w-full max-w-6xl flex flex-col gap-4 relative custom-scrollbar"
				style={{ maxHeight: "65vh", overflowY: "auto", padding: "10px", paddingRight: "15px" }}
			>
				{filteredRooms.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-white">
						<p className="text-sm">No rooms yet. Be the first to create one.</p>
					</div>
				) : (
					filteredRooms.map((room) => {
						const isFull = room.current_players >= room.max_players;
						return (
							<div key={room.id} className="flex justify-center w-full">
								<DynamicLiquidGlass width={1030} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.5} glassBgOpacity={0.001}>
									<div
										onClick={() => !isFull && handleJoinRoom(room)}
										className={`flex items-center justify-between w-full h-full  cursor-pointer rounded-2xl transition-colors group ${
											isFull ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"
										}`}
									>
										<DynamicLiquidGlass width={157} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
											{room.host}
										</DynamicLiquidGlass>

										<div className="flex-1 px-8 text-lg font-semibold italic text-white/90 group-hover:text-white transition-colors truncate text-center">
											{room.name}
										</div>

										<div className="flex items-center gap-6 shrink-0 text-white mt-10">
											<div className="flex flex-col items-center gap-2">
												<AccessIcon type={room.accessibility} glass={false} text={false} />
												<DynamicLiquidGlass width={107} height={46} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
													<div className="text-s font-mono flex items-start gap-1 mb-3">
														<img src="/icons/Person.svg" alt="" />
														<h2>
															{room.current_players}/{room.max_players}
														</h2>
													</div>
												</DynamicLiquidGlass>
											</div>
										</div>
									</div>
								</DynamicLiquidGlass>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
