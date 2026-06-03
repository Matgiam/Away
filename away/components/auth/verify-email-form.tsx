// ============================================================================
// auth/verify-email-form.tsx
// ----------------------------------------------------------------------------
// 6-digit OTP verification UI shown on /auth/verify-email after signup.
//
// The 6 individual <input> boxes handle:
//   * Single-digit input with auto-advance to the next box.
//   * Backspace going back to the previous box.
//   * Arrow keys for manual navigation.
//   * Paste — splits the pasted string across boxes from the current position.
//
// Plus a "Resend code" button that calls supabase.auth.resend.
// ============================================================================

"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

export function VerifyEmailForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const email = searchParams.get("email") ?? "";

	const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

	useEffect(() => {
		inputsRef.current[0]?.focus();
	}, []);

	const setDigitAt = (i: number, value: string) => {
		setDigits((prev) => {
			const next = [...prev];
			next[i] = value;
			return next;
		});
	};

	const handleChange = (i: number, raw: string) => {
		const cleaned = raw.replace(/\D/g, "");
		if (!cleaned) {
			setDigitAt(i, "");
			return;
		}
		if (cleaned.length === 1) {
			setDigitAt(i, cleaned);
			if (i < CODE_LENGTH - 1) inputsRef.current[i + 1]?.focus();
		} else {
			// Browser pasted multiple chars into a single box — spread across boxes
			// from the current position.
			const chars = cleaned.slice(0, CODE_LENGTH - i).split("");
			setDigits((prev) => {
				const next = [...prev];
				chars.forEach((c, idx) => {
					next[i + idx] = c;
				});
				return next;
			});
			const newPos = Math.min(i + chars.length, CODE_LENGTH - 1);
			inputsRef.current[newPos]?.focus();
		}
	};

	const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace" && !digits[i] && i > 0) {
			inputsRef.current[i - 1]?.focus();
			setDigitAt(i - 1, "");
		} else if (e.key === "ArrowLeft" && i > 0) {
			e.preventDefault();
			inputsRef.current[i - 1]?.focus();
		} else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
			e.preventDefault();
			inputsRef.current[i + 1]?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
		if (!pasted) return;
		const arr = Array(CODE_LENGTH).fill("");
		pasted.split("").forEach((c, idx) => {
			arr[idx] = c;
		});
		setDigits(arr);
		const focusPos = Math.min(pasted.length, CODE_LENGTH - 1);
		inputsRef.current[focusPos]?.focus();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const token = digits.join("");
		if (token.length !== CODE_LENGTH) {
			setError("Enter the 6-digit code from your email.");
			return;
		}
		if (!email) {
			setError("Missing email — start the sign-up again.");
			return;
		}
		setError(null);
		setInfo(null);
		setIsVerifying(true);
		try {
			const supabase = createClient();
			const { error } = await supabase.auth.verifyOtp({
				email,
				token,
				type: "signup",
			});
			if (error) throw error;
			router.push("/protected");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Verification failed");
		} finally {
			setIsVerifying(false);
		}
	};

	const handleResend = async () => {
		if (!email) {
			setError("Missing email — start the sign-up again.");
			return;
		}
		setError(null);
		setInfo(null);
		setIsResending(true);
		try {
			const supabase = createClient();
			const { error } = await supabase.auth.resend({ type: "signup", email });
			if (error) throw error;
			setInfo("A new code has been sent.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not resend code");
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className={cn("w-full max-w-md", className)} {...props}>
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10">
				<div className="mb-8 text-center">
					<h1 className="text-4xl italic font-light text-white mb-2">Verify email</h1>
					<p className="text-sm text-white/40 italic">
						{email ? (
							<>
								We sent a 6-digit code to <span className="text-white/70">{email}</span>
							</>
						) : (
							"Enter the 6-digit code from your email."
						)}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<div className="flex justify-center gap-2">
						{digits.map((d, i) => (
							<input
								key={i}
								ref={(el) => {
									inputsRef.current[i] = el;
								}}
								value={d}
								onChange={(e) => handleChange(i, e.target.value)}
								onKeyDown={(e) => handleKeyDown(i, e)}
								onPaste={handlePaste}
								inputMode="numeric"
								autoComplete={i === 0 ? "one-time-code" : "off"}
								maxLength={1}
								aria-label={`Digit ${i + 1}`}
								className="w-12 h-14 text-center text-2xl text-white italic bg-white/5 border border-white/10 rounded-xl outline-none focus:border-white/25 transition-colors"
							/>
						))}
					</div>

					{error && (
						<p className="text-sm text-red-400/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
							{error}
						</p>
					)}
					{info && (
						<p className="text-sm text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-center">
							{info}
						</p>
					)}

					<button
						type="submit"
						disabled={isVerifying}
						className="w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isVerifying ? "Verifying…" : "Verify"}
					</button>

					<button
						type="button"
						onClick={handleResend}
						disabled={isResending}
						className="text-sm italic text-white/60 hover:text-white transition-colors disabled:opacity-50"
					>
						{isResending ? "Sending…" : "Resend code"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm italic text-white/40">
					<Link href="/auth/login" className="hover:underline">
						← Back to login
					</Link>
				</p>
			</div>
		</div>
	);
}
