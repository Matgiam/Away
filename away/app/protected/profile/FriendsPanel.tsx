"use client";

import { useFriends } from "@/hooks/useFriends";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { acceptFriendRequest, removeFriendship } from "@/lib/friends";

export function FriendsPanel({ userId }: { userId: string }) {
	const { friends, pending, loading } = useFriends(userId);
	const online = useOnlinePresence(userId);

	const totalCount = friends.length;

	return (
		<>
			<div className="flex items-baseline gap-2 mb-4 shrink-0">
				<h2 className="text-white font-semibold text-2xl">Friends</h2>
				<span className="text-white/40 text-xs">({totalCount})</span>
			</div>

			<div className="flex flex-col gap-3 overflow-y-auto min-h-0">
				{pending.length > 0 && (
					<div className="shrink-0">
						<p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Requests</p>
						<ul className="space-y-2">
							{pending.map((req) => (
								<li key={req.friendshipId} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
									<span className="text-white text-sm truncate">{req.username}</span>
									<div className="flex items-center gap-1.5 shrink-0">
										<button
											onClick={() => acceptFriendRequest(req.friendshipId)}
											className="text-green-400 hover:text-green-300 text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
											aria-label="Accept"
										>
											✓
										</button>
										<button
											onClick={() => removeFriendship(req.friendshipId)}
											className="text-red-400/80 hover:text-red-300 text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
											aria-label="Decline"
										>
											✕
										</button>
									</div>
								</li>
							))}
						</ul>
						{friends.length > 0 && <div className="border-t border-white/8 mt-3" />}
					</div>
				)}

				<ul className="space-y-2.5">
					{loading && <li className="text-white/30 text-xs italic">Loading…</li>}

					{!loading && friends.length === 0 && pending.length === 0 && <li className="text-white/30 text-xs italic">No friends yet.</li>}

					{friends.map((f) => {
						const isOnline = online.has(f.userId);
						return (
							<li key={f.friendshipId} className="flex items-center justify-between group">
								<span className="text-white text-l tracking-wide truncate">{f.username}</span>
								<div className="flex items-center gap-2 shrink-0">
									<button
										onClick={() => {
											if (confirm(`Remove ${f.username}?`)) removeFriendship(f.friendshipId);
										}}
										className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white/60 hover:text-red-400 text-xs transition-opacity"
										aria-label="Remove friend"
									>
										✕
									</button>
									<span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-white/20"}`} />
									<span className="text-white text-sm tracking-wide truncate">{isOnline ? "online" : "offline"}</span>
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		</>
	);
}
