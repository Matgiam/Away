// ============================================================================
// utils.ts
// ----------------------------------------------------------------------------
// Tiny grab-bag of helpers that don't belong to any single feature:
//   * `cn`          — merges Tailwind class strings safely (resolves conflicts).
//   * `hasEnvVars`  — quick check that the Supabase env vars are present.
//   * `getSiteURL`  — canonical site origin used to build auth redirect URLs.
// ============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge any number of Tailwind class strings / arrays / conditional maps.
// `clsx` flattens the inputs into one string; `twMerge` then resolves
// conflicts (e.g. `px-2 px-4` → `px-4`) so the last value wins.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// True only when both Supabase public env vars are set. Used in places that
// need to short-circuit if the project hasn't been configured yet.
export function hasEnvVars() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Returns the canonical site URL used to build auth redirect targets (OAuth, magic links,
// password resets, etc.). Priority:
//   1. NEXT_PUBLIC_SITE_URL — explicit override, always wins. Set this on Vercel to your
//      custom domain (e.g. https://awaypiano.com) and the app will use it everywhere,
//      including server-rendered emails.
//   2. window.location.origin — when running in the browser, trust whatever domain the
//      user is actually on. This makes the app DOMAIN-AGNOSTIC: visiting from any
//      whitelisted domain gives a redirect back to that same domain.
//   3. NEXT_PUBLIC_VERCEL_URL — last-resort server-side fallback. Vercel auto-sets this
//      to the deployment URL (xxx.vercel.app), NOT the user's custom domain, so it must
//      only be used when nothing better is available.
//   4. localhost — local dev.
export function getSiteURL() {
  // 1. Explicit override wins.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, ""); // strip trailing slash for clean joins

  // 2. In the browser, mirror whatever origin the user actually landed on.
  if (typeof window !== "undefined") return window.location.origin;

  // 3. Server-side, fall back to Vercel's deployment URL if available.
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  // 4. Local dev default.
  return "http://localhost:3000";
}
