import { supabase } from "./supabaseClient";

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      queryParams: {
        access_type: "offline",
        prompt: "select_account consent",
      },
    },
  });
}
