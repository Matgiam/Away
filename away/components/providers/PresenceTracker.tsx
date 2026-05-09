"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ONLINE_CHANNEL = "online-users";

export function PresenceTracker() {
	useEffect(() => {
		let cancelled = false;
		const supabase = createClient();
		let channel: ReturnType<typeof supabase.channel> | null = null;

		(async () => {
			const { data } = await supabase.auth.getUser();
			if (cancelled || !data.user) return;
			channel = supabase.channel(ONLINE_CHANNEL, {
				config: { presence: { key: data.user.id } },
			});
			channel.subscribe(async (status) => {
				if (cancelled) return;
				if (status === "SUBSCRIBED") {
					try {
						await channel!.track({ at: Date.now() });
					} catch {}
				}
			});
		})();

		return () => {
			cancelled = true;
			if (channel) {
				try {
					channel.untrack();
				} catch {}
				supabase.removeChannel(channel);
			}
		};
	}, []);

	return null;
}
