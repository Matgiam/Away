"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

interface Player {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
	noteColorHex?: string;
	isMe: boolean;
	isFriend?: boolean;
}

interface PlayerListProps {
	players: Player[];
	canAddFriend?: boolean;
	pendingFriendIds?: Set<string>;
	incomingRequestByUserId?: Map<string, string>;
	onAddFriend?: (userId: string) => void;
	onAcceptFriend?: (friendshipId: string) => void;
	onDeclineFriend?: (friendshipId: string) => void;
	onViewProfile?: (playerId: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({
	players,
	canAddFriend = false,
	pendingFriendIds,
	incomingRequestByUserId,
	onAddFriend,
	onAcceptFriend,
	onDeclineFriend,
	onViewProfile,
}) => {
	const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!openPopoverId) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (!popoverRef.current) return;
			if (popoverRef.current.contains(e.target as Node)) return;
			setOpenPopoverId(null);
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpenPopoverId(null);
		};
		window.addEventListener("mousedown", handleClickOutside);
		window.addEventListener("keydown", handleKey);
		return () => {
			window.removeEventListener("mousedown", handleClickOutside);
			window.removeEventListener("keydown", handleKey);
		};
	}, [openPopoverId]);

	return (
		<div className="flex flex-col gap-4">
			{players.map((player) => {
				const incomingFriendshipId = player.userId ? incomingRequestByUserId?.get(player.userId) : undefined;
				const isOutgoing = !!player.userId && !!pendingFriendIds?.has(player.userId);
				const canRequest =
					canAddFriend &&
					!player.isMe &&
					!!player.userId &&
					!player.isFriend &&
					!isOutgoing &&
					!incomingFriendshipId &&
					!!onAddFriend;

				const isPopoverOpen = openPopoverId === player.id;

				return (
					<div key={player.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-3 relative">
							<button
								onClick={() => setOpenPopoverId(isPopoverOpen ? null : player.id)}
								className="text-white font-bold text-base tracking-wide hover:text-white/70 transition-colors text-left"
								title={player.isMe ? "Your profile" : `${player.displayName}'s profile`}
							>
								{player.displayName}
							</button>

							{!player.isMe && player.isFriend && (
								<img src="/icons/friends.svg" alt="" className="w-7 h-5 opacity-80" aria-label="Friend" />
							)}

							{!player.isMe && !player.isFriend && incomingFriendshipId && (
								<div className="flex items-center gap-1.5">
									<button
										onClick={() => onAcceptFriend?.(incomingFriendshipId)}
										className="text-green-400 hover:text-green-300 text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
										aria-label="Accept"
									>
										✓ Accept
									</button>
									{onDeclineFriend && (
										<button
											onClick={() => onDeclineFriend(incomingFriendshipId)}
											className="text-red-400/80 hover:text-red-300 text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
											aria-label="Decline"
										>
											✕
										</button>
									)}
								</div>
							)}

							{!player.isMe && !player.isFriend && !incomingFriendshipId && isOutgoing && (
								<span className="text-white/40 text-xs italic">Request sent</span>
							)}

							{canRequest && (
								<button
									onClick={() => onAddFriend!(player.userId!)}
									className="flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors text-sm"
								>
									<span className="text-lg leading-none">+</span>
									<span>Add friend</span>
								</button>
							)}

							{isPopoverOpen && (
								<div
									ref={popoverRef}
									className="absolute left-0 top-full mt-2 z-[60] min-w-[150px] rounded-xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl py-1.5"
								>
									<button
										onClick={() => {
											setOpenPopoverId(null);
											onViewProfile?.(player.id);
										}}
										className="w-full text-left px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors italic"
									>
										View profile
									</button>
								</div>
							)}
						</div>

						<div
							className="h-3.5 rounded-full"
							style={{
								width: "160px",
								backgroundColor: player.noteColorHex || PLAYER_COLORS_SOLID[player.colorIndex % PLAYER_COLORS_SOLID.length],
								opacity: 0.8,
							}}
						/>
					</div>
				);
			})}
		</div>
	);
};
