"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectAfterLogin = () => {
    const savedRole = localStorage.getItem("tenxo_role");
    if (savedRole === "provider") return "/provider";
    if (savedRole === "both") return "/developer";
    return "/developer";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(redirectAfterLogin());
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const path = redirectAfterLogin();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}${path}` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-white text-[13px] font-bold text-black">
              T
            </span>
            <span className="text-lg font-semibold tracking-tight text-text-primary">
              tenxo
            </span>
          </Link>
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-text-primary">
            Sign in to your account
          </h1>
          <p className="mt-2 text-[13px] text-text-tertiary">
            Access the Tenxo Compute Grid console
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[13px] font-medium text-text-primary transition-colors hover:bg-white/[0.05] disabled:opacity-50"
        >
          <GoogleIcon className="size-5" />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
            or
          </span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-tertiary/50 focus:border-white/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 pr-10 text-[13px] text-text-primary outline-none placeholder:text-text-tertiary/50 focus:border-white/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-[12px] text-red-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-text-tertiary">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent-purple hover:text-accent-purple/80">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
