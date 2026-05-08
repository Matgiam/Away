import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({ searchParams }: { searchParams: Promise<{ error: string }> }) {
	const params = await searchParams;
	return (
		<p className="text-sm italic text-white/40 leading-relaxed">
			{params?.error ? <>Code error: {params.error}</> : <>An unspecified error occurred.</>}
		</p>
	);
}

export default function Page({ searchParams }: { searchParams: Promise<{ error: string }> }) {
	return (
		<div className="w-full max-w-md">
			<div className="rounded-2xl border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-2xl px-8 py-10 text-center">
				<h1 className="text-4xl italic font-light text-white mb-4">Something went wrong</h1>
				<Suspense>
					<ErrorContent searchParams={searchParams} />
				</Suspense>
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
