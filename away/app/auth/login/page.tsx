"use client";

import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    const checkRedirect = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push("/");
        return;
      }
      const savedRedirect = sessionStorage.getItem("redirect_after_login");
      if (savedRedirect) {
        setRedirectTo(savedRedirect);
      }
    };
    checkRedirect();
  }, [router]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
