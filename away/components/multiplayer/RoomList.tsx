import { AccessIcon } from "@/components/AccessIcon";
import type { Room, Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "../DynamicLiquidglass";

interface RoomListProps {
	filter: Accessibility;
	setFilter: (filter: Accessibility) => void;
	filteredRooms: Room[];
	setShowCreate: (show: boolean) => void;
	handleJoinRoom: (room: Room) => void;
}

export default function RoomList({ filter, setFilter, filteredRooms, setShowCreate, handleJoinRoom }: RoomListProps) {
	return (
		<div className="flex flex-col items-center justify-center px-8">
			<div className="w-full max-w-5xl flex items-center justify-between mb-25">
				<button onClick={() => setShowCreate(true)}>
					<DynamicLiquidGlass width={198} height={69} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<div className="w-full h-full flex items-center justify-center text-white">Create Room</div>
					</DynamicLiquidGlass>
				</button>

				<div className="flex gap-2">
					{(["public", "private", "friends"] as const).map((type) => (
						<button key={type} onClick={() => setFilter(type)} className="hover:opacity-80 transition-opacity">
							<AccessIcon type={type} />
						</button>
					))}
				</div>
			</div>

			{/* Rooms List Container - ADDED .custom-scrollbar HERE */}
			<div
				className="w-full max-w-6xl flex flex-col gap-4 relative custom-scrollbar"
				style={{ maxHeight: "70vh", overflowY: "auto", padding: "10px", paddingRight: "15px" }}
			>
				{filteredRooms.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-white/20">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 mb-4 opacity-30">
							<path d="M9 17H5a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v0a2 2 0 0 0-2-2h-4M12 3v14M8 7l4-4 4 4" />
						</svg>
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

										<div className="flex items-center gap-6 shrink-0 text-white/40 mt-10">
											<div className="flex flex-col items-center gap-2">
												<AccessIcon type={room.accessibility} glass={false} />
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
