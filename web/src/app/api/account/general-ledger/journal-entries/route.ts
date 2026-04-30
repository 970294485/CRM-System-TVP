import { randomBytes } from "crypto";

import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { accountingItems, glJournalEntries, glJournalLines } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { errorChainText, looksLikeGeneralLedgerUnavailable } from "@/lib/finance/general-ledger-overview";

export const runtime = "nodejs";

const EPS = 1e-6;

const lineSchema = z.object({
  accountingItemId: z.string().uuid(),
  debit: z.number().finite().nonnegative().optional(),
  credit: z.number().finite().nonnegative().optional(),
  lineMemo: z.string().max(500).optional().nullable(),
});

const bodySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().max(2000).optional().nullable(),
  lines: z.array(lineSchema).min(2, "複式記賬至少需要兩行分錄"),
});

function docNo(entryDate: string): string {
  return `JE-${entryDate.replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditFinance(session)) {
    return NextResponse.json({ error: "未授權（需要財務或管理權限）" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const { entryDate, memo, lines } = parsed.data;

  const normalized = lines.map((ln, idx) => {
    const d = ln.debit ?? 0;
    const c = ln.credit ?? 0;
    return { ...ln, debit: d, credit: c, lineNo: idx + 1 };
  });

  for (const ln of normalized) {
    const hasD = ln.debit > EPS;
    const hasC = ln.credit > EPS;
    if (hasD === hasC) {
      return NextResponse.json(
        { error: `第 ${ln.lineNo} 行須為「借方」或「貸方」擇一且金額須大於 0` },
        { status: 400 }
      );
    }
  }

  let sumD = 0;
  let sumC = 0;
  for (const ln of normalized) {
    sumD += ln.debit;
    sumC += ln.credit;
  }
  if (Math.abs(sumD - sumC) > EPS) {
    return NextResponse.json({ error: `借貸不平衡：借方 ${sumD.toFixed(2)} ≠ 貸方 ${sumC.toFixed(2)}` }, { status: 400 });
  }

  const db = getDb();
  const itemIds = [...new Set(normalized.map((l) => l.accountingItemId))];

  try {
    const found =
      itemIds.length === 0
        ? []
        : await db.select({ id: accountingItems.id }).from(accountingItems).where(inArray(accountingItems.id, itemIds));
    const foundSet = new Set(found.map((r) => r.id));
    for (const id of itemIds) {
      if (!foundSet.has(id)) {
        return NextResponse.json({ error: `科目不存在：${id}` }, { status: 400 });
      }
    }
  } catch (e) {
    const msg = errorChainText(e);
    if (looksLikeGeneralLedgerUnavailable(msg)) {
      return NextResponse.json({ error: "總賬表尚未建立，無法過賬" }, { status: 503 });
    }
    throw e;
  }

  let documentNo = docNo(entryDate);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const [entry] = await db
        .insert(glJournalEntries)
        .values({
          documentNo,
          entryDate,
          memo: memo?.trim() ? memo.trim() : null,
          createdByUserId: session.user.id,
        })
        .returning({ id: glJournalEntries.id });

      if (!entry) throw new Error("insert header failed");

      await db.insert(glJournalLines).values(
        normalized.map((ln) => ({
          journalEntryId: entry.id,
          lineNo: ln.lineNo,
          accountingItemId: ln.accountingItemId,
          debit: ln.debit > EPS ? ln.debit.toFixed(2) : "0",
          credit: ln.credit > EPS ? ln.credit.toFixed(2) : "0",
          lineMemo: ln.lineMemo?.trim() ? ln.lineMemo.trim() : null,
        }))
      );

      return NextResponse.json({
        ok: true,
        id: entry.id,
        documentNo,
      });
    } catch (e) {
      const msg = errorChainText(e);
      if (/duplicate key|unique constraint/i.test(msg) && /document_no/i.test(msg)) {
        documentNo = docNo(entryDate);
        continue;
      }
      if (looksLikeGeneralLedgerUnavailable(msg)) {
        return NextResponse.json({ error: "總賬表尚未建立，無法過賬" }, { status: 503 });
      }
      console.error("[POST /api/account/general-ledger/journal-entries]", msg);
      return NextResponse.json(
        { error: "儲存憑證失敗", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "憑證編號重複次數過多，請稍後再試" }, { status: 503 });
}
