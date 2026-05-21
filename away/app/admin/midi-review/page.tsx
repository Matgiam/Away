import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminMidiReviewClient from "./AdminMidiReviewClient";

export const dynamic = "force-dynamic";

export default async function AdminMidiReviewPage() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getUser();
	if (!data.user) redirect("/auth/login?next=/admin/midi-review");

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_admin")
		.eq("id", data.user.id)
		.maybeSingle();

	const isAdmin = !!(profile as { is_admin: boolean } | null)?.is_admin;
	if (!isAdmin) {
		// Don't reveal the URL is admin-only — just send them home.
		redirect("/");
	}

	return <AdminMidiReviewClient />;
}
