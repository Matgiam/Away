import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookies on every request. Without this,
// server components (e.g. /protected/profile) read a stale anonymous cookie
// jar and `getUser()` returns null even when the client is logged in — which
// caused the "profile flash to login then back to home" bug. The pattern
// follows the Supabase + Next.js App Router docs verbatim.

export async function middleware(request: NextRequest) {
	let response = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					// Mirror cookie updates into both the incoming request (so the
					// rest of this middleware run sees them) and the outgoing
					// response (so the browser picks them up).
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					response = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
				},
			},
		},
	);

	// Calling getUser() triggers Supabase to validate the JWT against its
	// servers and refresh the session if needed. The cookie writes propagate
	// via the setAll callback above.
	await supabase.auth.getUser();

	return response;
}

export const config = {
	matcher: [
		// Run on every request except static assets and the Next.js internals.
		// Without this, the favicon and every JS chunk would hit the auth
		// refresh path needlessly.
		"/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$).*)",
	],
};
