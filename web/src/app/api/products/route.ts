import { randomUUID } from "crypto";
import { and, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb, getNeonSql } from "@/db";
import { products } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { saveProductImageFiles } from "@/lib/product-image-upload";
import { productMultipartSchema } from "@/lib/validations/product-form";

export const runtime = "nodejs";

const MAX_IMAGES = 12;

/** 報價單等：依名稱／SKU 搜尋產品（啟用中） */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));

  try {
    const db = getDb();
    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        basePrice: products.basePrice,
      })
      .from(products)
      .where(
        q
          ? and(eq(products.isActive, true), or(ilike(products.name, pattern), ilike(products.sku, pattern)))
          : eq(products.isActive, true)
      )
      .limit(limit);

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/products]", msg);
    return NextResponse.json(
      { error: "無法讀取產品", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditSales(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "無法解析表單" }, { status: 400 });
  }

  const imageFiles = formData
    .getAll("images")
    .filter((v): v is File => typeof v !== "string" && v != null && "arrayBuffer" in v);

  if (imageFiles.length > MAX_IMAGES) {
    return NextResponse.json({ error: `最多上傳 ${MAX_IMAGES} 張圖片` }, { status: 400 });
  }

  const raw = {
    sku: String(formData.get("sku") ?? ""),
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    base_price: String(formData.get("base_price") ?? ""),
    description: String(formData.get("description") ?? ""),
    attributes: String(formData.get("attributes") ?? "{}"),
    specifications: String(formData.get("specifications") ?? "{}"),
    is_active: String(formData.get("is_active") ?? "true"),
  };

  const validated = productMultipartSchema.safeParse(raw);
  if (!validated.success) {
    const msg = validated.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }
  const parsed = validated.data;

  const batchId = randomUUID();
  let imageUrls: string[];
  try {
    imageUrls = await saveProductImageFiles(imageFiles, batchId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "圖片儲存失敗";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const sql = getNeonSql();
  const attrsJson = JSON.stringify(parsed.attributes);
  const specsJson = JSON.stringify(parsed.specifications);
  const category = parsed.category ?? null;
  const basePrice = parsed.base_price;
  const description = parsed.description?.trim() ? parsed.description : null;

  try {
    const rows = await sql.query(
      `INSERT INTO products (
        sku, name, category, base_price, description,
        attributes, specifications, image_urls, is_active
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb, $8, $9
      ) RETURNING *`,
      [
        parsed.sku.trim(),
        parsed.name.trim(),
        category,
        basePrice,
        description,
        attrsJson,
        specsJson,
        imageUrls,
        parsed.is_active,
      ]
    );

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, product: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "SKU 已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
