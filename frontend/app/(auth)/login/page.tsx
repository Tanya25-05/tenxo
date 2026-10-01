"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <SignIn path="/login" routing="path" signUpUrl="/signup" fallbackRedirectUrl="/post-auth" />
    </div>
  );
}
