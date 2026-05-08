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

type FriendshipRow = {
	id: string;
	requester_id: string;
	addressee_id: string;
	status: string;
	requester: { id: string; username: string | null } | null;
	addressee: { id: string; username: string | null } | null;
};

const FRIENDSHIP_SELECT = `
	id,
	requester_id,
	addressee_id,
	status,
	requester:profiles!friendships_requester_id_fkey(id, username),
	addressee:profiles!friendships_addressee_id_fkey(id, username)
`;

export async function fetchFriends(userId: string): Promise<Friend[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_SELECT)
		.eq("status", "accepted")
		.or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

	if (!data) return [];

	return (data as unknown as FriendshipRow[]).map((f) => {
		const friend = f.requester_id === userId ? f.addressee : f.requester;
		return {
			friendshipId: f.id,
			userId: friend?.id ?? "",
			username: friend?.username ?? "Unknown",
		};
	});
}

export async function fetchPendingRequests(userId: string): Promise<PendingRequest[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_SELECT)
		.eq("status", "pending")
		.eq("addressee_id", userId);

	if (!data) return [];

	return (data as unknown as FriendshipRow[]).map((f) => ({
		friendshipId: f.id,
		requesterId: f.requester_id,
		username: f.requester?.username ?? "Unknown",
	}));
}

export async function sendFriendRequest(addresseeId: string): Promise<{ ok: boolean; error?: string }> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return { ok: false, error: "Not authenticated" };
	if (userData.user.id === addresseeId) return { ok: false, error: "Cannot add yourself" };

	const { error } = await supabase.from("friendships").insert({
		requester_id: userData.user.id,
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
