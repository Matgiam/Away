export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-gray-200">
      <div className="w-full max-w-md space-y-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <p className="text-white/60">
          We've sent you a verification link. Please check your email and click the link to verify your account.
        </p>
        <a
          href="/auth/sign-in"
          className="inline-block text-sm text-white hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
