"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyUsername } from "@/lib/friends";

export function UsernameEditor({ initialUsername }: { initialUsername: string }) {
	const router = useRouter();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(initialUsername);
	const [saving, setSaving] = useState(false);

	const startEdit = () => {
		setDraft(initialUsername);
		setIsEditing(true);
	};

	const cancelEdit = () => {
		setDraft(initialUsername);
		setIsEditing(false);
	};

	const handleSave = async () => {
		const trimmed = draft.trim();
		if (!trimmed || trimmed === initialUsername) {
			cancelEdit();
			return;
		}
		setSaving(true);
		const ok = await updateMyUsername(trimmed);
		if (ok) {
			try {
				const saved = sessionStorage.getItem("away_user");
				if (saved) {
					const parsed = JSON.parse(saved);
					sessionStorage.setItem("away_user", JSON.stringify({ ...parsed, username: trimmed }));
				}
			} catch {}
			setIsEditing(false);
			router.refresh();
		}
		setSaving(false);
	};

	const displayName = initialUsername.charAt(0).toUpperCase() + initialUsername.slice(1);

	if (!isEditing) {
		return (
			<div className="flex items-center gap-3">
				<p className="text-white font-semibold truncate">{displayName}</p>
				<button
					onClick={startEdit}
					className="text-white/40 hover:text-white text-xs italic transition-colors"
					aria-label="Edit username"
				>
					Edit
				</button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<input
				type="text"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleSave();
					if (e.key === "Escape") cancelEdit();
				}}
				autoFocus
				disabled={saving}
				className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-white/30 transition-colors disabled:opacity-50"
			/>
			<button
				onClick={handleSave}
				disabled={saving}
				className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
			>
				{saving ? "…" : "Save"}
			</button>
			<button
				onClick={cancelEdit}
				disabled={saving}
				className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
			>
				Cancel
			</button>
		</div>
	);
}
