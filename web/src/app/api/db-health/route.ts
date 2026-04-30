import { NextResponse } from "next/server";

import { pingDatabase } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not set. Add .env.local with your Neon URL." },
      { status: 503 }
    );
  }

  const result = await pingDatabase();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: result.message }, { status: 500 });
}
