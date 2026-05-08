import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
	const { code } = await searchParams;

	if (code) {
		const supabase = await createClient();
		await supabase.auth.exchangeCodeForSession(code);
		redirect("/");
	}

	return <HomeClient />;
}
