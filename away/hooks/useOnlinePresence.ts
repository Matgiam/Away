"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ONLINE_CHANNEL = "online-users";

export function useOnlinePresence(userId: string | null): Set<string> {
	const [online, setOnline] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!userId) return;
		const supabase = createClient();
		const channel = supabase.channel(ONLINE_CHANNEL, {
			config: { presence: { key: userId } },
		});

		channel.on("presence", { event: "sync" }, () => {
			const state = channel.presenceState();
			setOnline(new Set(Object.keys(state)));
		});

		channel.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				await channel.track({ at: Date.now() });
			}
		});

		return () => {
			try {
				channel.untrack();
			} catch {}
			supabase.removeChannel(channel);
		};
	}, [userId]);

	return online;
}
