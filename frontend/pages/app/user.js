import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function UserPage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => subscription?.unsubscribe();
  }, []);

  if (!session)
    return (
      <div className="marketing-main">Please sign in to view your profile.</div>
    );

  const user = session.user;

  return (
    <div className="marketing-main">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">Account</h1>
        <div className="mt-4 card p-4">
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>User ID:</strong> {user.id}
          </p>
        </div>
      </div>
    </div>
  );
}
