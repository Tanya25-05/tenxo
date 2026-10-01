"use client";

import { useState } from "react";
import { SignUp } from "@clerk/nextjs";

const ROLES = [
  { id: "developer", label: "Developer", desc: "Rent GPUs for AI workloads" },
  { id: "provider", label: "Provider", desc: "Earn by offering idle GPU capacity" },
  { id: "both", label: "Both", desc: "Rent GPUs and offer my own" },
] as const;

const PENDING_ROLE_KEY = "tenxo_role_pending";

export default function SignupPage() {
  const [role, setRole] = useState<string>("developer");
  const [roleChosen, setRoleChosen] = useState(false);

  if (!roleChosen) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="flex size-8 items-center justify-center rounded-md bg-white text-[13px] font-bold text-black mx-auto">
              T
            </span>
            <h1 className="mt-6 text-xl font-semibold tracking-tight text-text-primary">
              Create your account
            </h1>
            <p className="mt-2 text-[13px] text-text-tertiary">
              Join the decentralized GPU compute grid
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
              I want to
            </label>
            <div className="space-y-1.5">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    role === r.id
                      ? "border-accent-purple/50 bg-accent-purple/10"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"
                  }`}
                >
                  <p className="text-[13px] font-medium text-text-primary">{r.label}</p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem(PENDING_ROLE_KEY, role);
              setRoleChosen(true);
            }}
            className="mt-6 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-black transition-all hover:bg-white"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <SignUp path="/signup" routing="path" signInUrl="/login" fallbackRedirectUrl="/post-auth" />
    </div>
  );
}
