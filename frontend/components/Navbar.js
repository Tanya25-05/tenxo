import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { signInWithGoogle } from "../lib/authActions";

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const email = session?.user?.email || "";
  const avatarLetter = email ? email.charAt(0).toUpperCase() : "T";

  return (
    <header className="marketing-nav">
      <Link href="/" className="marketing-brand" aria-label="Tenxo home">
        <span className="marketing-brand-mark">T</span>
        <span>tenxo</span>
      </Link>

      <nav className="marketing-pill-nav" aria-label="Primary navigation">
        <Link href="/features">Product</Link>
        <Link href="/providers">Providers</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs">Docs</Link>
      </nav>

      <div className="marketing-actions">
        {!session ? (
          <>
            <button
              onClick={() => signInWithGoogle()}
              className="marketing-signin"
            >
              Sign in
            </button>
            <button
              onClick={() => signInWithGoogle()}
              className="marketing-signup"
            >
              Sign up
            </button>
          </>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((s) => !s)}
              className="tenxo-topbar-meta"
              aria-haspopup="true"
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,0.9)",
                  color: "#050505",
                  fontWeight: 700,
                }}
              >
                {avatarLetter}
              </div>
            </button>
            {open && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  marginTop: 8,
                  background: "#0b0b0b",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: 10,
                  borderRadius: 8,
                  minWidth: 200,
                }}
              >
                <div
                  style={{
                    padding: "0.25rem 0",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  {email}
                </div>
                <Link href="/app/user">
                  <a
                    style={{
                      display: "block",
                      padding: "0.35rem 0",
                      color: "white",
                    }}
                  >
                    Profile
                  </a>
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setSession(null);
                  }}
                  className="tenxo-btn-secondary"
                  style={{ marginTop: 8 }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
