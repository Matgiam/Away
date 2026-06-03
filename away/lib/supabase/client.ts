// ============================================================================
// supabase/client.ts
// ----------------------------------------------------------------------------
// Browser-side Supabase client factory.
//
// Uses `createBrowserClient` from `@supabase/ssr`, which is cookie-aware so
// the session set by `app/auth/...` server actions and refreshed by the
// `middleware.ts` `updateSession` call is visible here without any extra
// wiring.
//
// Always call `createClient()` rather than caching the result at module
// scope — the SSR helper hooks into the per-request cookie store, so it
// needs to be fresh in code paths that span request boundaries.
// ============================================================================

import { createBrowserClient } from "@supabase/ssr";

// Anon key is safe to ship to the browser — RLS policies do the heavy lifting.
// The `!` asserts the env vars are set; missing values are caught earlier by
// the `hasEnvVars` helper.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
