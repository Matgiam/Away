"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";
import { BadgedUsername } from "@/components/achievements/BadgedUsername";
import { getAchievement } from "@/lib/achievements";
import type { SoundfontOption } from "@/hooks/useAudioEngine";

interface Player {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
	noteColorHex?: string;
	soundfont?: string;
	equippedBadge?: string | null;
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
	soundfonts?: SoundfontOption[];
	currentSoundfont?: string;
	onCopySoundfont?: (key: string) => void;
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
	soundfonts,
	currentSoundfont,
	onCopySoundfont,
}) => {
	const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	const handleCopySoundfont = (playerId: string, soundfontKey: string) => {
		if (!onCopySoundfont) return;
		onCopySoundfont(soundfontKey);
		setCopiedPlayerId(playerId);
		window.setTimeout(() => {
			setCopiedPlayerId((current) => (current === playerId ? null : current));
		}, 1500);
	};

	const soundfontNameByKey = useMemo(() => {
		const map = new Map<string, string>();
		soundfonts?.forEach((sf) => map.set(sf.key, sf.name));
		return map;
	}, [soundfonts]);

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
				const isHovered = hoveredId === player.id;
				// For my own entry use the live `currentSoundfont` prop instead of the
				// synced `player.soundfont`, so the popover updates immediately when I switch.
				const effectiveSoundfont = player.isMe
					? currentSoundfont ?? player.soundfont
					: player.soundfont;
				const peerSoundfontName = effectiveSoundfont
					? soundfontNameByKey.get(effectiveSoundfont) ?? effectiveSoundfont
					: undefined;
				// Show the copy clipboard for any other player who exposes a soundfont — even
				// if it happens to match yours right now. Real-time presence updates change
				// `player.soundfont` (the popover re-renders with the new name), so a single
				// click always copies their current sound, not the one they had when you opened
				// the popover.
				const canCopySoundfont = !player.isMe && !!player.soundfont && !!onCopySoundfont;
				const showSoundfontTooltip = (isHovered || isPopoverOpen) && !!peerSoundfontName;
				const isCopied = copiedPlayerId === player.id;

				return (
					<div
						key={player.id}
						className="flex flex-col gap-1.5"
						onMouseEnter={() => setHoveredId(player.id)}
						onMouseLeave={() => setHoveredId((prev) => (prev === player.id ? null : prev))}
					>
						<div className="flex items-center gap-3 relative">
							<button
								onClick={() => setOpenPopoverId(isPopoverOpen ? null : player.id)}
								className="text-white font-bold text-base tracking-wide hover:text-white/70 transition-colors text-left inline-flex items-center gap-2"
								title={player.isMe ? "Your profile" : `${player.displayName}'s profile`}
							>
								{player.isMe ? (
									// BadgedUsername reads the equipped badge from localStorage (live updates).
									<BadgedUsername username={player.displayName} />
								) : (
									<>
										{(() => {
											const ach = player.equippedBadge
												? getAchievement(player.equippedBadge)
												: null;
											const Icon = ach?.icon;
											return Icon ? <Icon className="w-6 h-6 shrink-0" aria-hidden /> : null;
										})()}
										<span>{player.displayName}</span>
									</>
								)}
							</button>

							{showSoundfontTooltip && !isPopoverOpen && (
								<div className="absolute left-0 top-full mt-1 z-[55] px-2.5 py-1 rounded-md border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl text-white/85 text-xs whitespace-nowrap pointer-events-none shadow-lg">
									<span className="text-white/50">Soundfont: </span>
									<span className="italic">{peerSoundfontName}</span>
								</div>
							)}

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
									className="absolute left-0 top-full mt-2 z-[60] min-w-[220px] rounded-xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl py-1.5"
								>
									{peerSoundfontName && (
										<div className="px-4 py-2 border-b border-white/10">
											<div className="text-[10px] uppercase tracking-wider text-white/40">Soundfont</div>
											<div className="flex items-center gap-2 mt-0.5">
												<span className="text-sm text-white/90 italic truncate">
													{peerSoundfontName}
												</span>
												{canCopySoundfont && player.soundfont && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															handleCopySoundfont(player.id, player.soundfont!);
														}}
														className={`ml-auto flex items-center justify-center w-6 h-6 rounded-md transition-colors shrink-0 ${
															isCopied
																? "text-emerald-300 bg-emerald-400/10"
																: "text-white/50 hover:text-white hover:bg-white/10"
														}`}
														title={
															isCopied
																? "Soundfont copied"
																: `Use ${peerSoundfontName}`
														}
														aria-label="Copy this player's soundfont"
													>
														{isCopied ? (
															<svg
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="2.4"
																strokeLinecap="round"
																strokeLinejoin="round"
																className="w-3.5 h-3.5"
															>
																<path d="M5 12l5 5L20 7" />
															</svg>
														) : (
															<svg
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="1.8"
																strokeLinecap="round"
																strokeLinejoin="round"
																className="w-3.5 h-3.5"
															>
																<rect x="9" y="9" width="11" height="11" rx="2" />
																<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
															</svg>
														)}
													</button>
												)}
											</div>
										</div>
									)}
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
