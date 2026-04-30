import { and, asc, count, eq, gte, lte } from "drizzle-orm";

import {
  AccountingBasicsWorkspace,
  type AccountingCompanySettingsDTO,
  type PtCurrencyRow,
} from "@/components/accounting/accounting-basics-workspace";
import { ensureAccountingCompanySettingsRow } from "@/actions/accounting-basics";
import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  accountingCategories,
  accountingItems,
  accountingPeriods,
  ptCurrencies,
} from "@/db/schema";
import { canEditSettings } from "@/lib/authz";

export default async function AccountingBasicsPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const editable = canEditSettings(session);
  const db = getDb();

  const settingsRow = await ensureAccountingCompanySettingsRow();
  const rawYear = Number(searchParams.year);
  const displayYear =
    Number.isFinite(rawYear) && rawYear >= 2000 && rawYear <= 2100
      ? Math.floor(rawYear)
      : settingsRow.currentFiscalYear;

  const settings: AccountingCompanySettingsDTO = {
    id: settingsRow.id,
    currentFiscalYear: settingsRow.currentFiscalYear,
    baseCurrencyIso: settingsRow.baseCurrencyIso,
    updatedAtISO: settingsRow.updatedAt.toISOString(),
  };

  const periodRows = await db
    .select({
      yearMonth: accountingPeriods.yearMonth,
      isClosed: accountingPeriods.isClosed,
    })
    .from(accountingPeriods)
    .where(
      and(
        gte(accountingPeriods.yearMonth, `${displayYear}-01`),
        lte(accountingPeriods.yearMonth, `${displayYear}-12`)
      )
    );

  const periodClosedByYm = new Map<string, boolean>();
  for (const r of periodRows) {
    if (r.isClosed) periodClosedByYm.set(r.yearMonth, true);
  }

  const currRows = await db.select().from(ptCurrencies).orderBy(asc(ptCurrencies.sortOrder), asc(ptCurrencies.isoCode));
  const currencies: PtCurrencyRow[] = currRows.map((r) => ({
    id: r.id,
    isoCode: r.isoCode,
    label: r.label,
    quoteTwdPerUnit: r.quoteTwdPerUnit == null ? null : String(r.quoteTwdPerUnit),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));

  const typeCountRows = await db
    .select({
      accountType: accountingCategories.accountType,
      c: count(),
    })
    .from(accountingCategories)
    .where(eq(accountingCategories.isActive, true))
    .groupBy(accountingCategories.accountType);

  const typeCounts = typeCountRows.map((r) => ({
    accountType: r.accountType,
    count: Number(r.c),
  }));

  const [{ itemActiveTotal }] = await db
    .select({ itemActiveTotal: count() })
    .from(accountingItems)
    .where(eq(accountingItems.isActive, true));

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">會計基礎管理</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          會計年度、本位幣、月度關帳標記與匯率快照；入賬類別明細請由財務模組進入編輯。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            您目前無設定編輯權限，下列區塊以唯讀顯示。
          </p>
        ) : null}
      </header>

      <AccountingBasicsWorkspace
        editable={editable}
        settings={settings}
        displayYear={displayYear}
        periodClosedByYm={periodClosedByYm}
        currencies={currencies}
        typeCounts={typeCounts}
        totalItemsActive={Number(itemActiveTotal)}
      />
    </div>
  );
}
