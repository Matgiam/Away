import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
	const { code } = await searchParams;

	if (code) {
		redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/`);
	}

	return <HomeClient />;
}
