"use client";

import { useEffect, useState } from "react";
import {
	acceptFriendRequest,
	fetchPublicProfile,
	removeFriendship,
	sendFriendRequest,
	updateMyUsername,
	type PublicProfile,
} from "@/lib/friends";

interface ProfileModalProps {
	open: boolean;
	onClose: () => void;
	userId: string | null;
	isSelf: boolean;
	myUserId: string | null;
	fallbackDisplayName?: string;
	isFriend?: boolean;
	incomingFriendshipId?: string | null;
	pendingOutgoing?: boolean;
	onUsernameChanged?: (next: string) => void;
}

const ACHIEVEMENT_PLACEHOLDER_COUNT = 20;

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s`;
}

export const ProfileModal = ({
	open,
	onClose,
	userId,
	isSelf,
	myUserId,
	fallbackDisplayName,
	isFriend,
	incomingFriendshipId,
	pendingOutgoing,
	onUsernameChanged,
}: ProfileModalProps) => {
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [loading, setLoading] = useState(false);
	const [usernameDraft, setUsernameDraft] = useState("");
	const [isEditingName, setIsEditingName] = useState(false);
	const [savingUsername, setSavingUsername] = useState(false);
	const [friendBusy, setFriendBusy] = useState(false);
	const [localFriendState, setLocalFriendState] = useState<"none" | "friend" | "outgoing" | "incoming">("none");
	const [localIncomingId, setLocalIncomingId] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (isFriend) setLocalFriendState("friend");
		else if (incomingFriendshipId) {
			setLocalFriendState("incoming");
			setLocalIncomingId(incomingFriendshipId);
		} else if (pendingOutgoing) setLocalFriendState("outgoing");
		else setLocalFriendState("none");
	}, [open, isFriend, incomingFriendshipId, pendingOutgoing]);

	useEffect(() => {
		if (!open) return;
		setIsEditingName(false);
		if (!userId) return;
		let cancelled = false;
		setLoading(true);
		setProfile(null);
		fetchPublicProfile(userId).then((p) => {
			if (cancelled) return;
			setProfile(p);
			setUsernameDraft(p?.username ?? fallbackDisplayName ?? "");
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [open, userId, fallbackDisplayName]);

	if (!open) return null;

	const displayName = profile?.username || fallbackDisplayName || "Player";
	const titleName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
	const hasAccount = !!userId;
	const canEditUsername = isSelf && hasAccount;

	const handleSaveUsername = async () => {
		const trimmed = usernameDraft.trim();
		if (!trimmed) return;
		if (profile && trimmed === profile.username) {
			setIsEditingName(false);
			return;
		}
		setSavingUsername(true);
		const ok = await updateMyUsername(trimmed);
		setSavingUsername(false);
		if (ok) {
			setProfile((prev) => (prev ? { ...prev, username: trimmed } : prev));
			onUsernameChanged?.(trimmed);
			setIsEditingName(false);
		}
	};

	const handleAddFriend = async () => {
		if (!userId || !myUserId) return;
		setFriendBusy(true);
		const result = await sendFriendRequest(userId);
		setFriendBusy(false);
		if (result.ok) setLocalFriendState("outgoing");
	};

	const handleAcceptFriend = async () => {
		if (!localIncomingId) return;
		setFriendBusy(true);
		const ok = await acceptFriendRequest(localIncomingId);
		setFriendBusy(false);
		if (ok) setLocalFriendState("friend");
	};

	const handleDeclineFriend = async () => {
		if (!localIncomingId) return;
		setFriendBusy(true);
		const ok = await removeFriendship(localIncomingId);
		setFriendBusy(false);
		if (ok) setLocalFriendState("none");
	};

	const canRequestFriend = !isSelf && hasAccount && !!myUserId && myUserId !== userId;

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pb-40" onClick={onClose}>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
				style={{ height: "80vh", maxHeight: "650px" }}
			>
				<button
					onClick={onClose}
					className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white z-10"
					aria-label="Close"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>

				<header className="px-10 pt-10 pb-6 shrink-0">
					<div className="flex items-center gap-4 flex-wrap">
						{isEditingName && canEditUsername ? (
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={usernameDraft}
									onChange={(e) => setUsernameDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleSaveUsername();
										if (e.key === "Escape") {
											setIsEditingName(false);
											setUsernameDraft(profile?.username ?? fallbackDisplayName ?? "");
										}
									}}
									autoFocus
									disabled={savingUsername}
									className="bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-white text-2xl italic outline-none focus:border-white/30 transition-colors disabled:opacity-50 min-w-[260px]"
								/>
								<button
									onClick={handleSaveUsername}
									disabled={savingUsername || !usernameDraft.trim()}
									className="text-green-400 hover:text-green-300 text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
								>
									{savingUsername ? "Saving…" : "Save"}
								</button>
								<button
									onClick={() => {
										setIsEditingName(false);
										setUsernameDraft(profile?.username ?? fallbackDisplayName ?? "");
									}}
									disabled={savingUsername}
									className="text-white/60 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
								>
									Cancel
								</button>
							</div>
						) : (
							<>
								<h1 className="text-4xl italic font-semi-bold text-white tracking-wide break-all">{titleName}</h1>
								{canEditUsername && (
									<button
										onClick={() => setIsEditingName(true)}
										className="text-white/40 hover:text-white text-xs italic transition-colors"
										aria-label="Edit username"
									>
										Edit
									</button>
								)}
							</>
						)}

						{isSelf && (
							<span className="ml-auto text-white/40 text-xs italic uppercase tracking-widest">This is you</span>
						)}

						{!isSelf && hasAccount && (
							<div className="ml-auto flex items-center gap-2">
								{localFriendState === "friend" && (
									<span className="text-green-300/80 text-xs italic uppercase tracking-widest">Friend</span>
								)}
								{canRequestFriend && localFriendState === "none" && (
									<button
										onClick={handleAddFriend}
										disabled={friendBusy}
										className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white italic hover:bg-white/10 transition-colors disabled:opacity-50 text-sm"
									>
										+ Add friend
									</button>
								)}
								{canRequestFriend && localFriendState === "incoming" && (
									<div className="flex gap-2">
										<button
											onClick={handleAcceptFriend}
											disabled={friendBusy}
											className="px-3 py-2 rounded-xl border border-green-400/40 bg-green-500/15 text-green-200 text-sm hover:bg-green-500/25 disabled:opacity-50"
										>
											Accept
										</button>
										<button
											onClick={handleDeclineFriend}
											disabled={friendBusy}
											className="px-3 py-2 rounded-xl border border-red-400/30 bg-red-500/10 text-red-200/90 text-sm hover:bg-red-500/20 disabled:opacity-50"
										>
											Decline
										</button>
									</div>
								)}
								{canRequestFriend && localFriendState === "outgoing" && (
									<span className="text-white/40 text-xs italic">Request sent</span>
								)}
							</div>
						)}
					</div>
				</header>

				<div className="flex-1 px-10 pb-10 overflow-y-auto">
					{!hasAccount ? (
						<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-6">
							<p className="text-white/70 text-sm">
								<span className="font-medium text-white">{titleName}</span> is jamming as a guest. They don't have a
								public profile yet.
							</p>
							<p className="text-white/40 text-xs leading-relaxed mt-2">
								Guest players can play and chat in rooms, but stats, friends and profile become visible once they
								sign up.
							</p>
						</section>
					) : (
						<div className="flex flex-col gap-6">
							<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-6">
								<h2 className="text-white font-semibold text-xl mb-4">Statistics</h2>
								<dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<StatItem
										label="Time played"
										value={formatTime(profile?.timePlayedSeconds ?? 0)}
										loading={loading && !profile}
									/>
									<StatItem
										label="Notes played"
										value={(profile?.notesPlayed ?? 0).toLocaleString("en-US").replace(/,/g, "")}
										loading={loading && !profile}
									/>
									<StatItem
										label="Sessions"
										value={String(profile?.connexions ?? 0)}
										loading={loading && !profile}
									/>
									<StatItem
										label="Friends"
										value={String(profile?.friendCount ?? 0)}
										loading={loading && !profile}
									/>
								</dl>
							</section>

							<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-6">
								<div className="flex items-baseline justify-between mb-4">
									<h2 className="text-white font-semibold text-xl">Achievements</h2>
									<span className="text-white/30 text-xs italic">Coming soon</span>
								</div>
								<div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
									{Array.from({ length: ACHIEVEMENT_PLACEHOLDER_COUNT }).map((_, i) => (
										<div
											key={i}
											className="aspect-square rounded-xl border border-white/8 bg-white/[0.02] flex items-center justify-center"
											aria-hidden
										>
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="1.5"
												className="w-5 h-5 text-white/15"
											>
												<circle cx="12" cy="9" r="6" />
												<path d="M8 14l-2 7 6-3 6 3-2-7" />
											</svg>
										</div>
									))}
								</div>
							</section>

							{isSelf && (
								<a
									href="/protected/profile"
									className="self-start text-white/50 hover:text-white text-sm italic transition-colors"
								>
									Open full profile page →
								</a>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const StatItem = ({ label, value, loading }: { label: string; value: string; loading?: boolean }) => (
	<div className="flex flex-col gap-1">
		<dt className="text-white/40 text-xs uppercase tracking-wider">{label}</dt>
		{loading ? (
			<dd className="h-7 w-16 bg-white/5 rounded animate-pulse" />
		) : (
			<dd className="text-white text-2xl font-semibold">{value}</dd>
		)}
	</div>
);
