"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
        <h1 className="text-xl font-semibold tracking-tight text-white">Account</h1>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0c0c0d] p-5">
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-medium text-gray-500">Email</span>
              <p className="mt-0.5 text-gray-200">{user?.email || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">User ID</span>
              <p className="mt-0.5 font-mono text-xs text-gray-400">{user?.id || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
