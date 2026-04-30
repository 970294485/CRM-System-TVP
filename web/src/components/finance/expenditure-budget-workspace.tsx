"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MonthRow = {
  yearMonth: string;
  capAmount: string | null;
  isActive: boolean;
  notes: string | null;
  committedPurchaseTotal: number;
  remainingAgainstCap: number | null;
  enforcementOn: boolean;
};

type ApiMonths = {
  year: number;
  months: MonthRow[];
  warning?: string;
};

function fmtMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ExpenditureBudgetWorkspace({ editable }: { editable: boolean }) {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<ApiMonths | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { cap: string; active: boolean; notes: string }>>({});
  const [savingYm, setSavingYm] = useState<string | null>(null);

  const load = useCallback(async (yStr: string) => {
    setLoading(true);
    setErr(null);
    try {
      const y = Number.parseInt(yStr, 10);
      if (!Number.isFinite(y)) {
        setErr("請輸入有效年度");
        setData(null);
        return;
      }
      const res = await fetch(`/api/finance/expenditure-budget?year=${y}`, { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ApiMonths & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
      const d: Record<string, { cap: string; active: boolean; notes: string }> = {};
      for (const m of json.months) {
        d[m.yearMonth] = {
          cap: m.capAmount != null ? String(m.capAmount) : "",
          active: m.isActive,
          notes: m.notes ?? "",
        };
      }
      setDrafts(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(String(currentYear));
  }, [load, currentYear]);

  const saveRow = async (ym: string) => {
    if (!editable) return;
    const d = drafts[ym];
    if (!d) return;
    const capN = Number.parseFloat(d.cap.replace(/,/g, ""));
    if (!Number.isFinite(capN) || capN < 0) {
      toast.error("請輸入有效的預算上限（≥ 0）");
      return;
    }
    setSavingYm(ym);
    try {
      const res = await fetch("/api/finance/expenditure-budget", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: ym,
          capAmount: capN,
          isActive: d.active,
          notes: d.notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "儲存失敗");
      toast.success(`${ym} 預算已更新`);
      await load(year);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSavingYm(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="budget-y" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            預算年度
          </label>
          <Input
            id="budget-y"
            className="w-32"
            type="number"
            min={1990}
            max={2120}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load(year)} disabled={loading}>
          {loading ? "載入中…" : "重新載入"}
        </Button>
      </div>

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">管控規則（當前實作）</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>僅當某月「啟用」且已設定上限時，匯入採購單（模組 8 批次匯入）會檢核該月採購承諾額（以採購單 total 按 po_date 所屬月加總）。</li>
          <li>超過上限時匯入會被拒絕（HTTP 422）；角色含 <code className="text-[11px]">super_admin</code> 可繞過檢核。</li>
          <li>報銷單尚未接表，後續可共用同一預算池或分科目。</li>
        </ul>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/80">
              <th className="px-3 py-2">月份</th>
              <th className="px-3 py-2">採購承諾（已建單）</th>
              <th className="px-3 py-2">上限</th>
              <th className="px-3 py-2">啟用攔截</th>
              <th className="px-3 py-2">預算餘額</th>
              <th className="px-3 py-2">備註</th>
              {editable ? <th className="px-3 py-2">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading && !data?.months?.length ? (
              <tr>
                <td colSpan={editable ? 7 : 6} className="px-3 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : null}
            {(data?.months ?? []).map((row) => {
              const dr = drafts[row.yearMonth];
              return (
                <tr
                  key={row.yearMonth}
                  className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/60 dark:border-zinc-800 dark:odd:bg-zinc-900/30 dark:even:bg-zinc-900/15"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.yearMonth}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtMoney(row.committedPurchaseTotal)}</td>
                  <td className="px-3 py-2">
                    {editable && dr ? (
                      <Input
                        className="h-8 w-28 text-right text-xs tabular-nums"
                        value={dr.cap}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.yearMonth]: { ...prev[row.yearMonth]!, cap: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      <span className="tabular-nums">{row.capAmount != null ? fmtMoney(Number(row.capAmount)) : "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editable && dr ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300"
                        checked={dr.active}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.yearMonth]: { ...prev[row.yearMonth]!, active: e.target.checked },
                          }))
                        }
                      />
                    ) : (
                      <span className="text-xs text-zinc-500">{row.isActive ? "是" : "否"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.enforcementOn ? (
                      <span
                        className={
                          (row.remainingAgainstCap ?? 0) < 0
                            ? "font-medium text-rose-600 dark:text-rose-400"
                            : "text-zinc-800 dark:text-zinc-200"
                        }
                      >
                        {fmtMoney(row.remainingAgainstCap)}
                      </span>
                    ) : (
                      <span className="text-zinc-400">未啟用</span>
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    {editable && dr ? (
                      <Input
                        className="h-8 text-xs"
                        placeholder="可選"
                        value={dr.notes}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.yearMonth]: { ...prev[row.yearMonth]!, notes: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      <span className="line-clamp-2 text-xs text-zinc-500">{row.notes ?? "—"}</span>
                    )}
                  </td>
                  {editable ? (
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!dr || savingYm === row.yearMonth}
                        onClick={() => void saveRow(row.yearMonth)}
                      >
                        {savingYm === row.yearMonth ? "儲存中…" : "儲存"}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!loading && !data ? (
              <tr>
                <td colSpan={editable ? 7 : 6} className="px-3 py-8 text-center text-zinc-500">
                  無資料
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
