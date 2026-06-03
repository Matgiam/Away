// ============================================================================
// auth/forgot-password-form.tsx
// ----------------------------------------------------------------------------
// Step 1 of the password reset flow: ask Supabase to email a reset link.
// On success shows a "check your email" confirmation; the actual password
// change happens on /auth/update-password (which the email link points to).
// ============================================================================

"use client";

import { cn, getSiteURL } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleForgotPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		const supabase = createClient();
		setIsLoading(true);
		setError(null);

		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${getSiteURL()}/auth/update-password`,
			});
			if (error) throw error;
			setSuccess(true);
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={cn("w-full max-w-md", className)} {...props}>
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10">
				{success ? (
					<div className="text-center">
						<h1 className="text-4xl italic font-light text-white mb-3">Check your email</h1>
						<p className="text-sm italic text-white/40 leading-relaxed">
							If you registered using your email and password, you will receive a password reset email shortly.
						</p>
						<Link
							href="/auth/login"
							className="mt-8 inline-block text-sm italic text-white/60 hover:text-white transition-colors"
						>
							← Back to login
						</Link>
					</div>
				) : (
					<>
						<div className="mb-8 text-center">
							<h1 className="text-4xl italic font-light text-white mb-2">Reset password</h1>
							<p className="text-sm text-white/40 italic">We&apos;ll send you a link to reset your password.</p>
						</div>

						<form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<label htmlFor="email" className="text-xs uppercase tracking-widest text-white/60 font-medium">
									Email
								</label>
								<input
									id="email"
									type="email"
									placeholder="you@example.com"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white italic outline-none focus:border-white/25 transition-colors placeholder:text-white/20"
								/>
							</div>

							{error && <p className="text-sm text-red-400/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

							<button
								type="submit"
								disabled={isLoading}
								className="w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isLoading ? "Sending..." : "Send reset email"}
							</button>
						</form>

						<p className="mt-6 text-center text-sm italic text-white/40">
							Already have an account?{" "}
							<Link href="/auth/login" className="text-white hover:underline">
								Login
							</Link>
						</p>
					</>
				)}
			</div>
		</div>
	);
}
