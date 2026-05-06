import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Profile</h1>
      <div className="rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60">Email</label>
            <p className="mt-1 text-white">{data.user.email}</p>
          </div>
          <div>
            <label className="text-sm text-white/60">User ID</label>
            <p className="mt-1 font-mono text-sm text-white/80">{data.user.id}</p>
          </div>
          <div>
            <label className="text-sm text-white/60">Created At</label>
            <p className="mt-1 text-white/80">
              {new Date(data.user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
