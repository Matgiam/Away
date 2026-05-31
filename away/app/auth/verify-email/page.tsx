import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

// useSearchParams in the form requires a Suspense boundary in Next.js app router.
export default function Page() {
	return (
		<Suspense fallback={null}>
			<VerifyEmailForm />
		</Suspense>
	);
}
