import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleSlugs: string[];
    } & DefaultSession["user"];
  }

  interface User {
    roleSlugs?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roleSlugs?: string[];
  }
}
