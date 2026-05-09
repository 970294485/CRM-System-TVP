"use client";

import { Suspense } from "react";

import { LoginView } from "@/components/login-view";

function LoginFallback() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm text-zinc-500">載入登入…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginView />
    </Suspense>
  );
}
