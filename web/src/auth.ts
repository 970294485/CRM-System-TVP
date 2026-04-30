import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getDb } from "@/db";
import { roles, userRoles, users } from "@/db/schema";

/** Dev seed uses admin@example.com; typing `admin` in the login box maps here. */
function normalizeLoginEmail(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "admin") return "admin@example.com";
  return s;
}

/** NextAuth refuses to sign JWTs/cookies without a secret; dev fallback avoids silent login failure. */
const authSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  (process.env.NODE_ENV !== "production" ? "dev-only-insecure-placeholder-set-AUTH_SECRET" : "");

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawLogin = credentials?.email?.toString() ?? "";
        const email = normalizeLoginEmail(rawLogin);
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;

        try {
          const db = getDb();
          const [userRow] = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email}`)
            .limit(1);
          if (!userRow?.isActive) return null;

          const ok = await bcrypt.compare(password, userRow.passwordHash);
          if (!ok) return null;

          const roleRows = await db
            .select({ slug: roles.slug })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.userId, userRow.id));

          const roleSlugs = roleRows.map((r) => r.slug);

          return {
            id: userRow.id,
            email: userRow.email,
            name: userRow.name,
            roleSlugs,
          };
        } catch (err) {
          if (err instanceof CredentialsSignin) throw err;
          /* Avoid leaking DB/network errors as Auth.js "Configuration" (misleading AUTH_SECRET hint). */
          console.error("[auth] credentials authorize:", err);
          const e = new CredentialsSignin();
          e.code = "database_unavailable";
          throw e;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "roleSlugs" in user && Array.isArray((user as { roleSlugs: string[] }).roleSlugs)) {
        token.roleSlugs = (user as { roleSlugs: string[] }).roleSlugs;
      }
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roleSlugs = Array.isArray(token.roleSlugs) ? (token.roleSlugs as string[]) : [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
});
