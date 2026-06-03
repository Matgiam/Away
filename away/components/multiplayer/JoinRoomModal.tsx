// ============================================================================
// multiplayer/JoinRoomModal.tsx
// ----------------------------------------------------------------------------
// Password prompt shown when joining a private room. Form state lives in
// `useJoinRoom`; the actual verification happens server-side via the
// `join_private_room` RPC (the password never reaches the client).
// ============================================================================

import type { Room } from "@/hooks/useRooms";

interface JoinRoomModalProps {
	joiningRoom: Room | null;
	setJoiningRoom: (room: Room | null) => void;
	joinPassword: string;
	setJoinPassword: (pwd: string) => void;
	joinError: string;
	setJoinError: (err: string) => void;
	handleJoinWithPassword: () => void;
	resetJoin: () => void;
}

export default function JoinRoomModal({
	joiningRoom,
	setJoinPassword,
	joinPassword,
	joinError,
	setJoinError,
	handleJoinWithPassword,
	resetJoin,
}: JoinRoomModalProps) {
	if (!joiningRoom) return null;

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
			<div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/90 backdrop-blur-xl shadow-2xl px-10 py-12">
				<h2 className="text-center text-xl font-semibold italic text-white/90 mb-2">{joiningRoom.name}</h2>
				<p className="text-center text-xs text-white/30 mb-8">Enter room password</p>

				<input
					type="text"
					value={joinPassword}
					onChange={(e) => {
						setJoinPassword(e.target.value);
						setJoinError("");
					}}
					onKeyDown={(e) => e.key === "Enter" && handleJoinWithPassword()}
					autoFocus
					className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-sm outline-none focus:border-white/25 transition-colors mb-2 font-mono uppercase tracking-widest text-center"
				/>
				{joinError && <p className="text-center text-xs text-red-400/80 mb-4">{joinError}</p>}
				{!joinError && <div className="mb-4" />}

				<div className="flex gap-3">
					<button
						onClick={resetJoin}
						className="flex-1 py-3 rounded-lg border border-white/10 bg-white/4 text-white/50 text-sm hover:bg-white/8 transition-all"
					>
						Cancel
					</button>
					<button
						onClick={handleJoinWithPassword}
						className="flex-1 py-3 rounded-lg border border-white/20 bg-white/8 text-white text-sm font-medium hover:bg-white/14 transition-all"
					>
						Join
					</button>
				</div>
			</div>
		</div>
	);
}
