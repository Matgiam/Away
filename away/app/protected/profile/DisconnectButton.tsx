"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisconnectButton() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const handleDisconnect = async () => {
		setLoading(true);
		const supabase = createClient();
		await supabase.auth.signOut();
		router.push("/auth/login");
		router.refresh();
	};

	return (
		<button
			onClick={handleDisconnect}
			disabled={loading}
			className="flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
		>
			{loading ? "Disconnecting..." : "Disconnect"}
			<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
				<polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
				<line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		</button>
	);
}
