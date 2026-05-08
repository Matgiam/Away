import Link from "next/link";

export default function Page() {
	return (
		<div className="w-full max-w-md">
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10 text-center">
				<h1 className="text-4xl italic font-light text-white mb-3">Thank you!</h1>
				<p className="text-sm text-white/60 italic mb-2">Check your email to confirm</p>
				<p className="text-sm italic text-white/40 leading-relaxed">
					You&apos;ve successfully signed up. Please check your email to confirm your account before signing in.
				</p>
				<Link
					href="/auth/login"
					className="mt-8 inline-block text-sm italic text-white/60 hover:text-white transition-colors"
				>
					← Back to login
				</Link>
			</div>
		</div>
	);
}
