// ============================================================================
// supabase.ts
// ----------------------------------------------------------------------------
// Legacy single-client Supabase instance. Kept for backwards compatibility
// with a handful of older imports.
//
// For new code, prefer:
//   * `lib/supabase/client.ts` — browser client built on `@supabase/ssr`
//     (cookie-aware, plays nicely with Next.js middleware refresh).
//   * `lib/supabase/server.ts` — server-side equivalent for Route Handlers
//     and Server Components.
//
// The split versions are what the Supabase + Next.js quickstart recommends
// and what the auth pages, middleware, and most data-access modules use.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// Both env vars are guaranteed to be present at runtime — the `!` postfix
// asserts that to TypeScript. Missing values are caught by `hasEnvVars`
// elsewhere and surface as a configuration error to the user.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Module-level singleton — fine for the simple read/write callers that still
// use this file. Auth-sensitive code paths should use the SSR-aware clients.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
