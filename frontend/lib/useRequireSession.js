import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

export function useRequireSession() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error || !data.session) {
        setSession(null);
        setCheckingAuth(false);
        router.replace("/");
        return;
      }

      setSession(data.session);
      setCheckingAuth(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setCheckingAuth(false);
      if (!nextSession) router.replace("/");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return { checkingAuth, session };
}
