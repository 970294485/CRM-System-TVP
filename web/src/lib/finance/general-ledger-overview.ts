import { and, asc, desc, eq, gte, inArray, lte, sum } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import {
  accountingCategories,
  accountingItems,
  glJournalEntries,
  glJournalLines,
} from "@/db/schema";

import { num } from "@/lib/finance/ar-ap-snapshot";

const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  Asset: 0,
  Liability: 1,
  Equity: 2,
  Revenue: 3,
  Expense: 4,
};

export type GlChartItemDTO = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type GlChartCategoryDTO = {
  id: string;
  categoryCode: string;
  categoryName: string;
  accountType: string;
  items: GlChartItemDTO[];
};

export type TrialBalanceRowDTO = {
  accountingItemId: string;
  code: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  accountType: string;
  debit: number;
  credit: number;
  netDebit: number;
};

export type JournalLineDTO = {
  lineNo: number;
  accountingItemId: string;
  itemCode: string;
  itemName: string;
  debit: number;
  credit: number;
  lineMemo: string | null;
};

export type JournalEntryDTO = {
  id: string;
  documentNo: string;
  entryDate: string;
  memo: string | null;
  lines: JournalLineDTO[];
};

export type GeneralLedgerOverviewPayload = {
  year: number;
  dateFrom: string;
  dateTo: string;
  baseCurrencyIso: string;
  chart: GlChartCategoryDTO[];
  trialBalance: TrialBalanceRowDTO[];
  trialTotals: { debit: number; credit: number; balanced: boolean };
  journalEntries: JournalEntryDTO[];
  notes: {
    trialBalance: string;
    chart: string;
    journal: string;
  };
  /** 總賬表不存在或無法存取時，仍回傳 chart，並附警示 */
  warning?: string;
};

/** 將 Drizzle「Failed query…」底層 PG／Neon 錯誤一併串入（cause 常被放在 Error.cause） */
export function errorChainText(e: unknown): string {
  const parts: string[] = [];

  function walk(err: unknown, depth: number) {
    if (depth > 12 || err === undefined || err === null) return;
    if (err instanceof Error) {
      parts.push(err.message);
      walk(err.cause, depth + 1);
      return;
    }
    if (typeof err === "object") {
      const o = err as Record<string, unknown>;
      if (typeof o.message === "string") parts.push(o.message);
      if (typeof o.detail === "string") parts.push(o.detail);
      if (typeof o.code === "string") parts.push(String(o.code));
      if ("cause" in o) walk(o.cause, depth + 1);
    }
  }

  walk(e, 0);
  return parts.length > 0 ? parts.join("\n") : String(e);
}

/** Neon／PG 缺表、連線層包裝訊息不一，務必對 errorChainText 全文比對 */
export function isMissingGeneralLedgerTableError(message: string): boolean {
  const m = message;
  const namesGl = /gl_journal_entries|gl_journal_lines/i.test(m);
  if (!namesGl) return false;
  if (/42P01/i.test(m)) return true;
  if (/does\s+not\s+exist/i.test(m)) return true;
  if (/undefined[_ ]table/i.test(m)) return true;
  if (/relation\s+[\["]?[^\]" ]+[\]" ]?\s+does\s+not\s+exist/i.test(m)) return true;
  if (/no\s+such\s+table/i.test(m)) return true;
  return false;
}

/**
 * Drizzle 對失敗請求常只在前段印出 `Failed query: …`，底層 PG 錯可能在 cause（或遺漏）。
 * 只要失敗對象為總賬表，視為環境尚未遷移，介面應降級而非 500。
 */
export function looksLikeGeneralLedgerUnavailable(message: string): boolean {
  if (isMissingGeneralLedgerTableError(message)) return true;
  if (/Failed\s+query/i.test(message) && /\b(gl_journal_entries|gl_journal_lines)\b/i.test(message)) return true;
  return false;
}

export async function fetchGeneralLedgerOverview(
  db: NeonHttpDatabase<typeof schema>,
  year: number,
  baseCurrencyIso: string
): Promise<GeneralLedgerOverviewPayload> {
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;
  const MISSING_GL_WARNING =
    "總賬資料表（gl_journal_entries / gl_journal_lines）尚未建立或無法存取：試算表與憑證為空。請在 web 目錄執行 npm run db:apply:general-ledger-init 或套用 drizzle 0017_general_ledger.sql。";

  const catRows = await db
    .select({
      id: accountingCategories.id,
      categoryCode: accountingCategories.categoryCode,
      categoryName: accountingCategories.categoryName,
      accountType: accountingCategories.accountType,
      sortOrder: accountingCategories.sortOrder,
    })
    .from(accountingCategories)
    .orderBy(asc(accountingCategories.sortOrder), asc(accountingCategories.categoryCode));

  const itemRows = await db
    .select({
      id: accountingItems.id,
      categoryId: accountingItems.categoryId,
      code: accountingItems.code,
      name: accountingItems.name,
      isActive: accountingItems.isActive,
      sortOrder: accountingItems.sortOrder,
    })
    .from(accountingItems)
    .orderBy(asc(accountingItems.sortOrder), asc(accountingItems.code));

  const chart: GlChartCategoryDTO[] = catRows.map((c) => ({
    id: c.id,
    categoryCode: c.categoryCode,
    categoryName: c.categoryName,
    accountType: c.accountType,
    items: itemRows
      .filter((i) => i.categoryId === c.id)
      .map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        isActive: i.isActive,
      })),
  }));

  let sumMap = new Map<string, { d: number; c: number }>();
  let journalEntries: JournalEntryDTO[] = [];
  let warning: string | undefined;

  try {
    const sumRows = await db
      .select({
        accountingItemId: glJournalLines.accountingItemId,
        debitSum: sum(glJournalLines.debit),
        creditSum: sum(glJournalLines.credit),
      })
      .from(glJournalLines)
      .innerJoin(glJournalEntries, eq(glJournalLines.journalEntryId, glJournalEntries.id))
      .where(and(gte(glJournalEntries.entryDate, dateFrom), lte(glJournalEntries.entryDate, dateTo)))
      .groupBy(glJournalLines.accountingItemId);

    sumMap = new Map(
      sumRows.map((r) => [
        r.accountingItemId,
        {
          d: num(r.debitSum == null ? "0" : String(r.debitSum)),
          c: num(r.creditSum == null ? "0" : String(r.creditSum)),
        },
      ])
    );

    const entries = await db
      .select()
      .from(glJournalEntries)
      .where(and(gte(glJournalEntries.entryDate, dateFrom), lte(glJournalEntries.entryDate, dateTo)))
      .orderBy(desc(glJournalEntries.entryDate), desc(glJournalEntries.createdAt))
      .limit(40);

    const entryIds = entries.map((e) => e.id);
    const lineRows =
      entryIds.length === 0
        ? []
        : await db
            .select({
              journalEntryId: glJournalLines.journalEntryId,
              lineNo: glJournalLines.lineNo,
              accountingItemId: glJournalLines.accountingItemId,
              debit: glJournalLines.debit,
              credit: glJournalLines.credit,
              lineMemo: glJournalLines.lineMemo,
              itemCode: accountingItems.code,
              itemName: accountingItems.name,
            })
            .from(glJournalLines)
            .innerJoin(accountingItems, eq(glJournalLines.accountingItemId, accountingItems.id))
            .where(inArray(glJournalLines.journalEntryId, entryIds))
            .orderBy(asc(glJournalLines.journalEntryId), asc(glJournalLines.lineNo));

    const linesByEntry = new Map<string, JournalLineDTO[]>();
    for (const row of lineRows) {
      const list = linesByEntry.get(row.journalEntryId) ?? [];
      list.push({
        lineNo: row.lineNo,
        accountingItemId: row.accountingItemId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        debit: num(String(row.debit)),
        credit: num(String(row.credit)),
        lineMemo: row.lineMemo,
      });
      linesByEntry.set(row.journalEntryId, list);
    }

    journalEntries = entries.map((e) => ({
      id: e.id,
      documentNo: e.documentNo,
      entryDate: typeof e.entryDate === "string" ? e.entryDate : String(e.entryDate),
      memo: e.memo,
      lines: linesByEntry.get(e.id) ?? [],
    }));
  } catch (e) {
    const msg = errorChainText(e);
    if (!looksLikeGeneralLedgerUnavailable(msg)) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (!isMissingGeneralLedgerTableError(msg)) {
      console.warn("[general-ledger] GL 查詢失敗並降級（多為尚未建立總賬表）:", msg.slice(0, 800));
    }
    warning = MISSING_GL_WARNING;
    sumMap = new Map();
    journalEntries = [];
  }

  const tbRows: TrialBalanceRowDTO[] = [];
  for (const i of itemRows) {
    const cat = catRows.find((c) => c.id === i.categoryId);
    if (!cat) continue;
    const s = sumMap.get(i.id) ?? { d: 0, c: 0 };
    const debit = s.d;
    const credit = s.c;
    tbRows.push({
      accountingItemId: i.id,
      code: i.code,
      name: i.name,
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      accountType: cat.accountType,
      debit,
      credit,
      netDebit: debit - credit,
    });
  }

  tbRows.sort((a, b) => {
    const ta = ACCOUNT_TYPE_ORDER[a.accountType] ?? 99;
    const tb_ = ACCOUNT_TYPE_ORDER[b.accountType] ?? 99;
    if (ta !== tb_) return ta - tb_;
    return a.code.localeCompare(b.code);
  });

  let tDebit = 0;
  let tCredit = 0;
  for (const r of tbRows) {
    tDebit += r.debit;
    tCredit += r.credit;
  }
  const balanced = Math.abs(tDebit - tCredit) < 1e-6;

  return {
    year,
    dateFrom,
    dateTo,
    baseCurrencyIso,
    chart,
    trialBalance: tbRows,
    trialTotals: { debit: tDebit, credit: tCredit, balanced },
    journalEntries,
    ...(warning ? { warning } : {}),
    notes: {
      trialBalance:
        "試算平衡表為所選年度內總賬分錄之借方／貸方發生額合計；總借必須等於總貸。餘額欄為本科目借減貸（展示用，正式結餘請依科目餘額方向解讀）。",
      chart:
        "會計科目樹與「入賬類別與項目」「會計相關錄入」共用同一主檔；新增科目請至資料輸入模組維護。",
      journal:
        "下列為本年度已過賬之手工憑證；業務單據自動拋帳尚未對接時，可先用記賬憑證補登調整。",
    },
  };
}
