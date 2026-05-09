import { NextRequest, NextResponse } from "next/server";
import { or, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { inventory } from "@/db/schema";

export const runtime = "nodejs";

const lineSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
});

const bodySchema = z.object({
  lines: z.array(lineSchema),
});

/** 依合同／報價明細列回傳各列對應之現有庫存合計（多倉加總）。 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求內容須為 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  const lines = parsed.data.lines;
  const hints = lines.map(() => ({ stockQty: null as number | null }));

  const productIds = [...new Set(lines.map((l) => l.product_id).filter((x): x is string => !!x))];
  const skus = [...new Set(lines.map((l) => (l.sku?.trim() ? l.sku.trim() : null)).filter((x): x is string => !!x))];

  if (productIds.length === 0 && skus.length === 0) {
    return NextResponse.json({ hints });
  }

  try {
    const db = getDb();
    const conds = [];
    if (productIds.length > 0) conds.push(inArray(inventory.productId, productIds));
    if (skus.length > 0) conds.push(inArray(inventory.sku, skus));
    const whereExpr = conds.length === 1 ? conds[0]! : or(...conds);

    const rows = await db
      .select({
        productId: inventory.productId,
        sku: inventory.sku,
        stockQty: inventory.stockQty,
      })
      .from(inventory)
      .where(whereExpr ?? sql`false`);

    const sumByProduct = new Map<string, number>();
    const sumBySku = new Map<string, number>();
    for (const r of rows) {
      sumByProduct.set(r.productId, (sumByProduct.get(r.productId) ?? 0) + r.stockQty);
      const sk = r.sku.trim();
      if (sk) sumBySku.set(sk, (sumBySku.get(sk) ?? 0) + r.stockQty);
    }

    lines.forEach((line, i) => {
      const pid = line.product_id ?? undefined;
      const sk = line.sku?.trim() ?? "";
      let q: number | null = null;
      if (pid && sumByProduct.has(pid)) q = sumByProduct.get(pid)!;
      else if (sk && sumBySku.has(sk)) q = sumBySku.get(sk)!;
      hints[i] = { stockQty: q };
    });

    return NextResponse.json({ hints });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/inventory/stock-hints]", msg);
    return NextResponse.json(
      {
        error: "無法讀取庫存",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
