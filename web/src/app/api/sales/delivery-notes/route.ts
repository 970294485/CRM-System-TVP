import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { allocateNextDocumentNumber } from "@/actions/pt-data-master";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers, deliveryNotes, type QuotationLineItem } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import {
  isDeliveryNotesTableMissingError,
  listDeliveryNotesViaNeonSql,
} from "@/lib/sales/delivery-notes-list-fallback";
import { loadSalesContractDetail } from "@/lib/sales/load-sales-contract";

export const runtime = "nodejs";

function hkTodayYmd(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong", hour12: false }).slice(0, 10);
}

const createSchema = z.object({
  contract_id: z.string().uuid(),
  ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: deliveryNotes.id,
        dnNo: deliveryNotes.dnNo,
        contractId: deliveryNotes.contractId,
        sourceContractNo: deliveryNotes.sourceContractNo,
        customerName: deliveryNotes.customerName,
        shipDate: deliveryNotes.shipDate,
        status: deliveryNotes.status,
        createdAt: deliveryNotes.createdAt,
      })
      .from(deliveryNotes)
      .orderBy(desc(deliveryNotes.shipDate));
    const items = rows.map((r) => ({
      id: r.id,
      dnNo: r.dnNo,
      contractId: r.contractId,
      sourceContractNo: r.sourceContractNo,
      customerName: r.customerName,
      shipDate: r.shipDate,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/delivery-notes]", msg);

    if (isDeliveryNotesTableMissingError(msg)) {
      return NextResponse.json({
        items: [],
        hint: "送貨單資料表尚未建立。請在專案 web 目錄執行：npm run db:apply:delivery-notes（需設定 DATABASE_URL）。",
      });
    }

    try {
      const items = await listDeliveryNotesViaNeonSql();
      console.warn("[GET /api/sales/delivery-notes] Drizzle 失敗，已改用 SQL 列表:", msg);
      return NextResponse.json({ items });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[GET /api/sales/delivery-notes] fallback", msg, msg2);
      return NextResponse.json(
        {
          error: "無法讀取送貨單",
          detail: process.env.NODE_ENV !== "production" ? `${msg} | ${msg2}` : undefined,
          hint: isDeliveryNotesTableMissingError(msg2)
            ? "請執行 npm run db:apply:delivery-notes"
            : undefined,
        },
        { status: 500 }
      );
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限開立送貨單" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求內容須為 JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  const contract = await loadSalesContractDetail(parsed.data.contract_id);
  if (!contract) {
    return NextResponse.json({ error: "找不到銷售合同" }, { status: 404 });
  }

  if (contract.status === "Cancelled") {
    return NextResponse.json({ error: "已取消的合同無法開立送貨單" }, { status: 400 });
  }

  const rawItems = contract.items;
  const itemsSnapshot: QuotationLineItem[] = Array.isArray(rawItems)
    ? JSON.parse(JSON.stringify(rawItems)) as QuotationLineItem[]
    : [];

  let shipToAddress: string | null = null;
  try {
    const db = getDb();
    if (contract.customerId) {
      const [cust] = await db
        .select({ address: customers.address })
        .from(customers)
        .where(eq(customers.id, contract.customerId))
        .limit(1);
      shipToAddress = cust?.address?.trim() ? cust.address.trim() : null;
    }

    let dnNo: string;
    try {
      const alloc = await allocateNextDocumentNumber("delivery_note");
      dnNo = alloc.code;
    } catch (allocErr) {
      const amsg = allocErr instanceof Error ? allocErr.message : String(allocErr);
      return NextResponse.json(
        {
          error: "無法取得送貨單編號",
          detail: process.env.NODE_ENV !== "production" ? amsg : undefined,
          hint:
            /Unknown numbering key/i.test(amsg) || /delivery_note/i.test(amsg)
              ? "請於「文件編號」新增類型鍵 delivery_note（或執行 npm run db:seed）"
              : undefined,
        },
        { status: 400 }
      );
    }

    const shipDate = parsed.data.ship_date ?? hkTodayYmd();
    const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

    const [inserted] = await db
      .insert(deliveryNotes)
      .values({
        dnNo,
        contractId: contract.id,
        sourceContractNo: contract.contractNo,
        customerId: contract.customerId,
        customerName: contract.customerName,
        customerPhone: contract.customerPhone,
        customerEmail: contract.customerEmail,
        shipToAddress,
        shipDate,
        items: itemsSnapshot,
        notes,
        status: "Issued",
      })
      .returning({
        id: deliveryNotes.id,
        dnNo: deliveryNotes.dnNo,
        contractId: deliveryNotes.contractId,
        sourceContractNo: deliveryNotes.sourceContractNo,
        customerName: deliveryNotes.customerName,
        shipDate: deliveryNotes.shipDate,
        status: deliveryNotes.status,
        createdAt: deliveryNotes.createdAt,
      });

    return NextResponse.json({ item: inserted }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/sales/delivery-notes]", msg);
    return NextResponse.json(
      {
        error: "無法開立送貨單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /delivery_notes|does not exist/i.test(msg) ? "請執行 npm run db:apply:delivery-notes" : undefined,
      },
      { status: 500 }
    );
  }
}
