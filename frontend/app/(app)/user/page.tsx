"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";

export default function UserPage() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => subscription?.unsubscribe();
  }, []);

  const user = session?.user;

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
              <p className="mt-0.5 text-text-primary">{user?.email || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-tertiary">User ID</span>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">{user?.id || "—"}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
