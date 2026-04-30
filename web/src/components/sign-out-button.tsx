"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="text-zinc-900 underline dark:text-zinc-100"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      登出
    </button>
  );
}
