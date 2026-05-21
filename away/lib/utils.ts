import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window !== "undefined") return window.location.origin;

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
