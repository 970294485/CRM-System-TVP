import Link from "next/link";

import { saveAccountingCompanySettings, saveAccountingPeriodClosed } from "@/actions/accounting-basics";
import { savePtCurrency } from "@/actions/pt-data-master";

export type PtCurrencyRow = {
  id: string;
  isoCode: string;
  label: string | null;
  quoteTwdPerUnit: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AccountingCompanySettingsDTO = {
  id: string;
  currentFiscalYear: number;
  baseCurrencyIso: string;
  updatedAtISO: string;
};

const TYPE_LABEL_ZH: Record<string, string> = {
  Asset: "資產",
  Liability: "負債",
  Equity: "權益",
  Revenue: "收入",
  Expense: "費用",
};

function cardClass() {
  return "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80";
}

export function AccountingBasicsWorkspace({
  editable,
  settings,
  displayYear,
  periodClosedByYm,
  currencies,
  typeCounts,
  totalItemsActive,
}: {
  editable: boolean;
  settings: AccountingCompanySettingsDTO;
  displayYear: number;
  periodClosedByYm: Map<string, boolean>;
  currencies: PtCurrencyRow[];
  typeCounts: { accountType: string; count: number }[];
  totalItemsActive: number;
}) {
  const currencyOptions =
    currencies.filter((c) => c.isActive).length > 0 ? currencies.filter((c) => c.isActive) : currencies;

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${displayYear}-${m}`;
  });

  return (
    <div className="space-y-8">
      <section className={cardClass()}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">會計年度與本位幣</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          曆年制下「會計年度」為西元年；本位幣須已存在於下方幣別主檔。
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          最後更新：{new Date(settings.updatedAtISO).toLocaleString("zh-TW")}
        </p>

        {editable ? (
          <form action={saveAccountingCompanySettings} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="currentFiscalYear" className="mb-1 block text-sm font-medium">
                當前會計年度
              </label>
              <input
                id="currentFiscalYear"
                name="currentFiscalYear"
                type="number"
                min={2000}
                max={2100}
                required
                defaultValue={settings.currentFiscalYear}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="baseCurrencyIso" className="mb-1 block text-sm font-medium">
                記帳本位幣 ISO
              </label>
              {currencyOptions.length > 0 ? (
                <select
                  id="baseCurrencyIso"
                  name="baseCurrencyIso"
                  defaultValue={
                    currencyOptions.some((c) => c.isoCode === settings.baseCurrencyIso)
                      ? settings.baseCurrencyIso
                      : currencyOptions[0].isoCode
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-950"
                >
                  {currencyOptions.map((c) => (
                    <option key={c.id} value={c.isoCode}>
                      {c.isoCode}
                      {c.label ? ` — ${c.label}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <p className="text-sm text-amber-700 dark:text-amber-400">尚無幣別，請先至文件主檔建立。</p>
                  <input type="hidden" name="baseCurrencyIso" value={settings.baseCurrencyIso} />
                </>
              )}
            </div>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              儲存
            </button>
          </form>
        ) : (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">會計年度</dt>
              <dd className="font-medium">{settings.currentFiscalYear}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">本位幣</dt>
              <dd className="font-mono font-medium">{settings.baseCurrencyIso}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className={cardClass()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">月度結帳狀態</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              已關帳月份可作為後續校驗依據；未出現在資料庫之月份視為開放。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/dashboard/account/accounting-basics?year=${displayYear - 1}`}
              scroll={false}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              ◀ {displayYear - 1}
            </Link>
            <span className="rounded-md bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800">{displayYear} 年</span>
            <Link
              href={`/dashboard/account/accounting-basics?year=${displayYear + 1}`}
              scroll={false}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {displayYear + 1} ▶
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((ym) => {
            const closed = periodClosedByYm.get(ym) === true;
            return (
              <div
                key={ym}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  closed
                    ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                    : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                }`}
              >
                <span className="font-mono">{ym}</span>
                <span
                  className={`text-xs font-medium shrink-0 ${
                    closed ? "text-amber-800 dark:text-amber-200" : "text-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  {closed ? "已關帳" : "開放"}
                </span>
                {editable ? (
                  <form action={saveAccountingPeriodClosed}>
                    <input type="hidden" name="yearMonth" value={ym} />
                    <input type="hidden" name="closed" value={closed ? "0" : "1"} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      {closed ? "重新開放" : "標記關帳"}
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">入賬類別概覽</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              類別／項目請至「會計管理 → 入賬類別與項目」維護。
            </p>
          </div>
          <Link
            href="/dashboard/accounting"
            className="text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100"
          >
            前往編輯 →
          </Link>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["Asset", "Liability", "Equity", "Revenue", "Expense"] as const).map((t) => {
            const hit = typeCounts.find((x) => x.accountType === t);
            const n = hit?.count ?? 0;
            return (
              <div key={t} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/80">
                <dt className="text-xs text-zinc-500">{TYPE_LABEL_ZH[t] ?? t}</dt>
                <dd className="text-lg font-semibold">{n}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          啟用中之入賬項目總數：
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalItemsActive}</span>
        </p>
      </section>

      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              幣別與匯率（兌新台幣快照）
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              每 1 單位外幣兌 TWD；完整新增／刪除幣別請至{" "}
              <Link href="/dashboard/doc-master?tab=currency" className="font-medium underline underline-offset-2">
                文件主檔 · 幣別與匯率
              </Link>
              。
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-700">
              <tr>
                <th className="pb-2 pr-3 font-medium">ISO</th>
                <th className="pb-2 pr-3 font-medium">名稱</th>
                <th className="pb-2 pr-3 font-medium">對 TWD 匯率</th>
                <th className="pb-2 pr-3 font-medium">狀態</th>
                {editable ? <th className="pb-2 font-medium">調整</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {currencies.map((c) => (
                <tr key={c.id} className={!c.isActive ? "opacity-60" : undefined}>
                  <td className="py-2 pr-3 font-mono text-xs">{c.isoCode}</td>
                  <td className="py-2 pr-3">{c.label ?? "—"}</td>
                  <td className="py-2 pr-3">{c.quoteTwdPerUnit ?? "—"}</td>
                  <td className="py-2 pr-3">{c.isActive ? "啟用" : "停用"}</td>
                  {editable ? (
                    <td className="py-2">
                      <form action={savePtCurrency} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="mode" value="update" />
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="isoCode" value={c.isoCode} />
                        <input type="hidden" name="label" value={c.label ?? ""} />
                        <input type="hidden" name="sortOrder" value={String(c.sortOrder)} />
                        {c.isActive ? <input type="hidden" name="isActive" value="on" /> : null}
                        <input
                          name="quoteTwdPerUnit"
                          defaultValue={c.quoteTwdPerUnit ?? ""}
                          placeholder="例 32.5"
                          className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        />
                        <button
                          type="submit"
                          className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                        >
                          更新匯率
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {currencies.length === 0 ? <p className="mt-2 text-sm text-zinc-500">尚無幣別資料。</p> : null}
        </div>
      </section>
    </div>
  );
}
