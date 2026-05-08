"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		const supabase = createClient();
		setIsLoading(true);
		setError(null);

		try {
			const { error } = await supabase.auth.updateUser({ password });
			if (error) throw error;
			router.push("/protected");
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={cn("w-full max-w-md", className)} {...props}>
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10">
				<div className="mb-8 text-center">
					<h1 className="text-4xl italic font-light text-white mb-2">New password</h1>
					<p className="text-sm text-white/40 italic">Please enter your new password below.</p>
				</div>

				<form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<label htmlFor="password" className="text-xs uppercase tracking-widest text-white/60 font-medium">
							New password
						</label>
						<input
							id="password"
							type="password"
							placeholder="New password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white italic outline-none focus:border-white/25 transition-colors placeholder:text-white/20"
						/>
					</div>

					{error && <p className="text-sm text-red-400/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

					<button
						type="submit"
						disabled={isLoading}
						className="w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? "Saving..." : "Save new password"}
					</button>
				</form>
			</div>
		</div>
	);
}
