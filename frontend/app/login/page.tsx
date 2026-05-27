"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push("/developer");
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
