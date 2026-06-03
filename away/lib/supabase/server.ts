// ============================================================================
// supabase/server.ts
// ----------------------------------------------------------------------------
// Server-side Supabase client factory, used by Route Handlers and Server
// Components.
//
// Uses `createServerClient` from `@supabase/ssr` and bridges the Next.js
// cookies API into the Supabase auth helpers. The Supabase library reads
// /writes auth cookies through the `getAll` / `setAll` callbacks below;
// without this bridge the server would see an anonymous user even when
// the browser has a session.
//
// Pattern lifted from the Supabase + Next.js App Router quickstart — see
// https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
// ============================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Returns a fresh client per call — Server Components / Route Handlers run
// per request and want a request-scoped cookie binding.
export async function createClient() {
  // `cookies()` is async in Next.js 15 and must be awaited before any sync use.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read: hand the request's full cookie list to Supabase.
        getAll() {
          return cookieStore.getAll();
        },
        // Write: Supabase asks us to set refreshed auth cookies. Inside a
        // Server Component this throws (response is already flushed), but
        // that's safe — the middleware's `updateSession` will set them on
        // the NEXT request.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
