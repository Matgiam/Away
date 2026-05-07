"use client";

import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

interface Player {
	id: string;
	displayName: string;
	colorIndex: number;
	isMe: boolean;
	isFriend?: boolean;
}

interface PlayerListProps {
	players: Player[];
	onAddFriend?: (id: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, onAddFriend }) => {
	return (
		<div className="flex flex-col gap-4">
			{players.map((player) => (
				<div key={player.id} className="flex flex-col gap-1.5">
					<div className="flex items-center gap-3">
						<span className="text-white font-bold text-base tracking-wide">{player.isMe ? player.displayName : player.displayName}</span>

						{!player.isMe && player.isFriend && (
							<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-5 h-5 opacity-60">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
						)}

						{!player.isMe && !player.isFriend && onAddFriend && (
							<button
								onClick={() => onAddFriend(player.id)}
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
			))}
		</div>
	);
};
