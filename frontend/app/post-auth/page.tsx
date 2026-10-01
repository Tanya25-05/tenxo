"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const PENDING_ROLE_KEY = "tenxo_role_pending";

export default function PostAuthPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      router.replace("/login");
      return;
    }

    const finish = (role: string | undefined) => {
      router.replace(role === "provider" ? "/provider" : "/developer");
    };

    const existingRole = user.unsafeMetadata?.role as string | undefined;
    if (existingRole) {
      finish(existingRole);
      return;
    }

    const pendingRole = localStorage.getItem(PENDING_ROLE_KEY);
    if (pendingRole) {
      localStorage.removeItem(PENDING_ROLE_KEY);
      user
        .update({ unsafeMetadata: { role: pendingRole } })
        .catch(() => {})
        .finally(() => finish(pendingRole));
      return;
    }

    finish(undefined);
  }, [isLoaded, isSignedIn, user, router]);

  return (
    <div className="grid min-h-screen place-items-center text-sm text-text-secondary">
      Completing sign-in...
    </div>
  );
}
