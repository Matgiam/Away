import { createClient } from "@/lib/supabase/client";

export type Friend = {
	friendshipId: string;
	userId: string;
	username: string;
};

export type PendingRequest = {
	friendshipId: string;
	requesterId: string;
	username: string;
};

export type OutgoingRequest = {
	friendshipId: string;
	addresseeId: string;
	username: string;
};

type FriendshipRow = {
	id: string;
	requester_id: string;
	addressee_id: string;
	status: string;
};

const FRIENDSHIP_COLUMNS = "id, requester_id, addressee_id, status";

async function fetchUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (ids.length === 0) return map;
	const supabase = createClient();
	const { data } = await supabase.from("profiles").select("id, username").in("id", ids);
	if (!data) return map;
	for (const p of data as { id: string; username: string | null }[]) {
		map.set(p.id, p.username ?? "Unknown");
	}
	return map;
}

export async function fetchFriends(userId: string): Promise<Friend[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "accepted")
		.or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

	const rows = (data as FriendshipRow[] | null) ?? [];
	const otherIds = rows.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
	const usernames = await fetchUsernamesByIds(otherIds);

	return rows.map((f) => {
		const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
		return {
			friendshipId: f.id,
			userId: otherId,
			username: usernames.get(otherId) ?? "Unknown",
		};
	});
}

export async function fetchPendingRequests(userId: string): Promise<PendingRequest[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "pending")
		.eq("addressee_id", userId);

	const rows = (data as FriendshipRow[] | null) ?? [];
	const usernames = await fetchUsernamesByIds(rows.map((f) => f.requester_id));

	return rows.map((f) => ({
		friendshipId: f.id,
		requesterId: f.requester_id,
		username: usernames.get(f.requester_id) ?? "Unknown",
	}));
}

export async function fetchOutgoingRequests(userId: string): Promise<OutgoingRequest[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "pending")
		.eq("requester_id", userId);

	const rows = (data as FriendshipRow[] | null) ?? [];
	const usernames = await fetchUsernamesByIds(rows.map((f) => f.addressee_id));

	return rows.map((f) => ({
		friendshipId: f.id,
		addresseeId: f.addressee_id,
		username: usernames.get(f.addressee_id) ?? "Unknown",
	}));
}

export async function sendFriendRequest(addresseeId: string): Promise<{ ok: boolean; error?: string }> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return { ok: false, error: "Not authenticated" };
	if (userData.user.id === addresseeId) return { ok: false, error: "Cannot add yourself" };

	const myId = userData.user.id;

	const { data: incoming } = await supabase
		.from("friendships")
		.select("id")
		.eq("status", "pending")
		.eq("requester_id", addresseeId)
		.eq("addressee_id", myId)
		.maybeSingle();

	if (incoming) {
		const ok = await acceptFriendRequest(incoming.id);
		return ok ? { ok: true } : { ok: false, error: "Could not accept existing request" };
	}

	const { error } = await supabase.from("friendships").insert({
		requester_id: myId,
		addressee_id: addresseeId,
		status: "pending",
	});

	if (error) {
		if (error.code === "23505") return { ok: false, error: "Request already exists" };
		return { ok: false, error: error.message };
	}
	return { ok: true };
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
	const supabase = createClient();
	const { error } = await supabase
		.from("friendships")
		.update({ status: "accepted", updated_at: new Date().toISOString() })
		.eq("id", friendshipId);
	return !error;
}

export async function removeFriendship(friendshipId: string): Promise<boolean> {
	const supabase = createClient();
	const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
	return !error;
}

export type PublicProfile = {
	userId: string;
	username: string;
	timePlayedSeconds: number;
	notesPlayed: number;
	connexions: number;
	friendCount: number;
};

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
	const supabase = createClient();
	const [{ data: profile }, { data: stats }, { count }] = await Promise.all([
		supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
		supabase
			.from("user_stats")
			.select("time_played_seconds, notes_played, connexions")
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("friendships")
			.select("id", { count: "exact", head: true })
			.eq("status", "accepted")
			.or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
	]);

	if (!profile && !stats) return null;

	return {
		userId,
		username: profile?.username ?? "Unknown",
		timePlayedSeconds: stats?.time_played_seconds ?? 0,
		notesPlayed: stats?.notes_played ?? 0,
		connexions: stats?.connexions ?? 0,
		friendCount: count ?? 0,
	};
}

export async function updateMyUsername(username: string): Promise<boolean> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return false;

	const trimmed = username.trim();
	if (!trimmed) return false;

	const { error: profileError } = await supabase
		.from("profiles")
		.update({ username: trimmed, updated_at: new Date().toISOString() })
		.eq("id", userData.user.id);

	if (profileError) return false;

	await supabase.auth.updateUser({ data: { username: trimmed } });
	return true;
}
