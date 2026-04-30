import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { roles, userRoles, users } from "@/db/schema";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const db = getDb();
    const [{ total }] = await db.select({ total: count() }).from(users);
    if (Number(total ?? 0) > 0) {
      return NextResponse.json({ error: "Bootstrap only allowed when no users exist." }, { status: 403 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { email, password, name } = parsed.data;
    const normalized = email.trim().toLowerCase();

    const [superAdmin] = await db
      .select()
      .from(roles)
      .where(eq(roles.slug, "super_admin"))
      .limit(1);
    if (!superAdmin) {
      return NextResponse.json(
        { error: "Role super_admin not found. Run npm run db:seed first." },
        { status: 500 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({
        email: normalized,
        passwordHash,
        name,
      })
      .returning({ id: users.id });

    if (!created) {
      return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
    }

    await db.insert(userRoles).values({
      userId: created.id,
      roleId: superAdmin.id,
    });

    return NextResponse.json({ ok: true, userId: created.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
