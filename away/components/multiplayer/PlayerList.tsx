"use client";

import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

interface Player {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
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
}

export const PlayerList: React.FC<PlayerListProps> = ({
	players,
	canAddFriend = false,
	pendingFriendIds,
	incomingRequestByUserId,
	onAddFriend,
	onAcceptFriend,
	onDeclineFriend,
}) => {
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

				return (
					<div key={player.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-3">
							<span className="text-white font-bold text-base tracking-wide">{player.displayName}</span>

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
						</div>

						<div
							className="h-3.5 rounded-full"
							style={{
								width: "160px",
								backgroundColor: PLAYER_COLORS_SOLID[player.colorIndex % PLAYER_COLORS_SOLID.length],
								opacity: 0.8,
							}}
						/>
					</div>
				);
			})}
		</div>
	);
};
