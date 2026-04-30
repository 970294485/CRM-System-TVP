import { and, desc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { generateCustomerServiceCaseNo } from "@/lib/customer-service-case-no";
import { customerServiceCaseCreateSchema } from "@/lib/validations/customer-service";
import { getDb } from "@/db";
import {
  customerServiceCaseNotes,
  customerServiceCases,
  customers,
} from "@/db/schema";

export const runtime = "nodejs";

function missingTableHint(msg: string): string | undefined {
  if (/customer_service_cases|customer_service_case_notes|relation|does not exist/i.test(msg)) {
    return "請在 web 目錄執行：npm run db:apply:customer-service-init";
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const status = (req.nextUrl.searchParams.get("status") ?? "").trim();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(200, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 80));

  try {
    const db = getDb();
    const pattern = q ? `%${q}%` : null;

    const conditions = [];
    if (status && ["open", "in_progress", "resolved", "closed"].includes(status)) {
      conditions.push(eq(customerServiceCases.status, status));
    }
    if (pattern) {
      conditions.push(
        or(
          ilike(customerServiceCases.caseNo, pattern),
          ilike(customerServiceCases.title, pattern),
          ilike(customerServiceCases.customerNameSnapshot, pattern)
        )!
      );
    }

    const whereClause = conditions.length ? (conditions.length === 1 ? conditions[0]! : and(...conditions)) : undefined;

    const rows = await db
      .select({
        id: customerServiceCases.id,
        caseNo: customerServiceCases.caseNo,
        customerId: customerServiceCases.customerId,
        customerNameSnapshot: customerServiceCases.customerNameSnapshot,
        title: customerServiceCases.title,
        category: customerServiceCases.category,
        channel: customerServiceCases.channel,
        status: customerServiceCases.status,
        priority: customerServiceCases.priority,
        summary: customerServiceCases.summary,
        openedAt: customerServiceCases.openedAt,
        updatedAt: customerServiceCases.updatedAt,
      })
      .from(customerServiceCases)
      .where(whereClause)
      .orderBy(desc(customerServiceCases.openedAt))
      .limit(limit);

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/customer-service/cases]", msg);
    return NextResponse.json(
      {
        error: "無法讀取客服案件",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: missingTableHint(msg),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = customerServiceCaseCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const d = parsed.data;
  const db = getDb();

  let customerNameSnapshot = (d.customer_name_snapshot ?? "").trim();
  const customerId = d.customer_id ?? null;

  if (customerId) {
    const [c] = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "找不到指定客戶" }, { status: 400 });
    }
    customerNameSnapshot = c.name;
  }

  const summary = d.summary?.trim() ? d.summary.trim() : null;
  const initialNote = d.initial_note?.trim() ? d.initial_note.trim() : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const caseNo = generateCustomerServiceCaseNo();
    try {
      const [created] = await db
        .insert(customerServiceCases)
        .values({
          caseNo,
          customerId,
          customerNameSnapshot,
          title: d.title.trim(),
          category: d.category ?? "inquiry",
          channel: d.channel ?? "other",
          status: d.status ?? "open",
          priority: d.priority ?? "medium",
          summary,
          createdByUserId: userId,
        })
        .returning();

      if (!created) {
        return NextResponse.json({ error: "建立失敗" }, { status: 500 });
      }

      if (initialNote) {
        await db.insert(customerServiceCaseNotes).values({
          caseId: created.id,
          body: initialNote,
          createdByUserId: userId,
        });
      }

      return NextResponse.json({ ok: true, item: created });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate/i.test(msg) && /case_no/i.test(msg)) {
        continue;
      }
      console.error("[POST /api/customer-service/cases]", msg);
      return NextResponse.json(
        {
          error: "無法建立案件",
          detail: process.env.NODE_ENV !== "production" ? msg : undefined,
          hint: missingTableHint(msg),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "單號重複，請稍後再試" }, { status: 503 });
}
