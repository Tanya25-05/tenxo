"use client";

import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/Card";

export default function UserPage() {
  const { user } = useUser();

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
          Profile
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">Account</h1>
        <Card className="mt-4">
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-xs font-medium text-text-tertiary">Email</span>
              <p className="mt-0.5 text-text-primary">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-tertiary">User ID</span>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">{user?.externalId || user?.id || "—"}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
