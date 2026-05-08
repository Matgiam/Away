import Link from "next/link";

export default function VerifyPage() {
	return (
		<div className="w-full max-w-md">
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10 text-center">
				<h1 className="text-4xl italic font-light text-white mb-3">Check your email</h1>
				<p className="text-sm italic text-white/40 leading-relaxed">
					We&apos;ve sent you a verification link. Please check your email and click the link to verify your account.
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
