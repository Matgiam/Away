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
	onAddFriend?: (userId: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, canAddFriend = false, pendingFriendIds, onAddFriend }) => {
	return (
		<div className="flex flex-col gap-4">
			{players.map((player) => {
				const isPending = !!player.userId && !!pendingFriendIds?.has(player.userId);
				const canRequest = canAddFriend && !player.isMe && !!player.userId && !player.isFriend && !isPending && !!onAddFriend;

				return (
					<div key={player.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-3">
							<span className="text-white font-bold text-base tracking-wide">{player.displayName}</span>

							{!player.isMe && player.isFriend && (
								<img src="/icons/friends.svg" alt="" className="w-7 h-5 opacity-80" aria-label="Friend" />
							)}

							{!player.isMe && isPending && <span className="text-white/40 text-xs italic">Request sent</span>}

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
