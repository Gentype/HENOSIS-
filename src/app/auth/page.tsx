"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/logo";
import { useUser } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialMode = sp.get("mode") === "signup" ? "signup" : "signin";
  // `then=generate` signals the user was trying to generate while logged out.
  // After Google sign-in we bounce them back to "/" so the home prompt-box
  // (which reads the persisted draft) repopulates their text.
  const then = sp.get("then");
  const callbackUrl = then === "generate" ? "/" : "/projects";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const signIn = useUser((s) => s.signIn);
  // The NextAuth session is the canonical source for "is this browser
  // authenticated right now?" — it's resolved server-side and handed to
  // SessionProvider as `initialSession`, so it's correct on the very first
  // client render. The `useUser` zustand store only fills in *after*
  // `/api/me` resolves, which is too slow to use as the redirect trigger:
  // a freshly-signed-in user lands on /auth, sees the Google button before
  // the store hydrates, and ends up sign-in-looping. Watch the session
  // instead so the bounce happens immediately.
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";

  useEffect(() => setMode(initialMode), [initialMode]);

  // If already signed in, bounce so /auth never strands a logged-in user.
  useEffect(() => {
    if (isAuthenticated) router.replace(callbackUrl);
  }, [isAuthenticated, router, callbackUrl]);

  async function doGoogle() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signIn(callbackUrl);
    } finally {
      // signIn redirects, but if the redirect is cancelled we still want the button usable.
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col p-8 lg:p-12">
        <Link href="/" className="self-start">
          <Logo size="md" />
        </Link>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-muted text-sm">
              {mode === "signin"
                ? "Sign in with Google to continue building."
                : "One click in. Start with 3 free generations on the Bronze tier — upgrade anytime."}
            </p>

            <button
              type="button"
              onClick={doGoogle}
              disabled={submitting}
              className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors py-3 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              {submitting ? "Opening Google…" : "Continue with Google"}
            </button>

            <p className="mt-6 text-sm text-muted text-center">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-accent hover:underline underline-offset-4"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
            <p className="mt-3 text-xs text-subtle text-center">
              Either way, the Google flow handles both new and returning accounts.
            </p>
          </div>
        </div>
        <div className="text-xs text-subtle">
          By continuing you agree to our Terms and Privacy.
        </div>
      </div>

      {/* Right — visual */}
      <div className="hidden lg:flex relative items-center justify-center bg-radial-spot border-l border-border overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="relative max-w-md p-10 text-center">
          <div className="hero-headline text-5xl font-semibold tracking-tight leading-tight">
            One prompt. One stunning website.
          </div>
          <p className="mt-4 text-muted">
            Henosis writes the design, code and copy so you can launch the same day.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {["#b8e3c9", "#6dd99e", "#f0c861"].map((c) => (
              <div
                key={c}
                className="aspect-square rounded-2xl border border-border"
                style={{
                  background: `radial-gradient(120% 120% at 20% 20%, ${c}, transparent 60%), #0a0a0a`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.96H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthSkeleton() {
  return (
    <div className="min-h-screen grid place-items-center text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}
