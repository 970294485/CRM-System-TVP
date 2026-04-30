"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { GeneralLedgerOverviewPayload } from "@/lib/finance/general-ledger-overview";

type OverviewApi = GeneralLedgerOverviewPayload & { warning?: string; notes?: GeneralLedgerOverviewPayload["notes"] | null };

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DraftLine = { accountingItemId: string; debit: string; credit: string; lineMemo: string };

export function GeneralLedgerWorkspace(props: { initialYear: number; canPostJournal: boolean }) {
  const minY = 2000;
  const maxY = 2100;
  const [year, setYear] = useState(props.initialYear);
  const [data, setData] = useState<OverviewApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hideZeroTb, setHideZeroTb] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headerMemo, setHeaderMemo] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([
    { accountingItemId: "", debit: "", credit: "", lineMemo: "" },
    { accountingItemId: "", debit: "", credit: "", lineMemo: "" },
  ]);
  const [formErr, setFormErr] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxY; y >= minY; y--) list.push(y);
    return list;
  }, []);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/account/general-ledger/overview?year=${y}`, { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as OverviewApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
      setYear(json.year);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(props.initialYear);
  }, [load, props.initialYear]);

  const filteredTb = useMemo(() => {
    if (!data?.trialBalance) return [];
    if (!hideZeroTb) return data.trialBalance;
    return data.trialBalance.filter((r) => r.debit > 1e-6 || r.credit > 1e-6);
  }, [data?.trialBalance, hideZeroTb]);

  function resetDraft() {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setHeaderMemo("");
    setDraftLines([
      { accountingItemId: "", debit: "", credit: "", lineMemo: "" },
      { accountingItemId: "", debit: "", credit: "", lineMemo: "" },
    ]);
    setFormErr(null);
  }

  async function submitJournal() {
    setFormErr(null);
    const lines = draftLines
      .filter((r) => r.accountingItemId.trim())
      .map((r) => {
        const d = Number(r.debit.replace(/,/g, ""));
        const c = Number(r.credit.replace(/,/g, ""));
        return {
          accountingItemId: r.accountingItemId.trim(),
          debit: Number.isFinite(d) && d > 0 ? d : undefined,
          credit: Number.isFinite(c) && c > 0 ? c : undefined,
          lineMemo: r.lineMemo.trim() || null,
        };
      });

    if (lines.length < 2) {
      setFormErr("至少需要兩行有效分錄（已選科目）。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/general-ledger/journal-entries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          memo: headerMemo.trim() || null,
          lines,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "儲存失敗");
      setDialogOpen(false);
      resetDraft();
      await load(year);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-zinc-500">載入總賬…</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">會計年度</span>
          <select
            value={year}
            disabled={loading}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (!Number.isFinite(y)) return;
              void load(y);
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={() => void load(year)} disabled={loading}>
          {loading ? "更新中…" : "重新整理"}
        </Button>
        {props.canPostJournal ? (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            新增記賬憑證
          </Button>
        ) : (
          <p className="text-xs text-zinc-500">僅具財務或管理權限者可過賬。</p>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={hideZeroTb}
            onChange={(e) => setHideZeroTb(e.target.checked)}
            className="rounded border-zinc-300"
          />
          試算表隱藏無發生額科目
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/accounting">
            入賬類別與項目
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/accounting-entry">
            會計相關錄入
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/account/accounting-basics">
            會計基礎管理
          </Link>
        </div>
      </div>

      {data?.baseCurrencyIso ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">金額：{data.baseCurrencyIso}</p>
      ) : null}

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      {data && data.notes ? (
        <>
          <section className="flex flex-wrap gap-3">
            <div
              className={`rounded-lg border px-4 py-3 shadow-sm ${
                data.trialTotals.balanced
                  ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/25"
                  : "border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/25"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">試算借方合計</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(data.trialTotals.debit)}</p>
            </div>
            <div
              className={`rounded-lg border px-4 py-3 shadow-sm ${
                data.trialTotals.balanced
                  ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/25"
                  : "border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/25"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">試算貸方合計</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(data.trialTotals.credit)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-xs text-zinc-500">平衡檢查</p>
              <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {data.trialTotals.balanced ? "借貸平衡" : "不平衡（請檢查未過賬或缺口資料）"}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">會計科目（總賬科目樹）</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.chart.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {c.categoryCode} {c.categoryName}
                  </p>
                  <p className="text-xs text-zinc-500">{c.accountType}</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300">
                    {c.items.length === 0 ? (
                      <li className="text-zinc-400">尚無明細科目</li>
                    ) : (
                      c.items.map((i) => (
                        <li key={i.id} className={i.isActive ? "" : "text-zinc-400 line-through"}>
                          <span className="font-mono">{i.code}</span> {i.name}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="crm-table-shell overflow-x-auto">
            <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              試算平衡表（{data.dateFrom} ~ {data.dateTo}）
            </div>
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-3 py-2 font-medium">類型</th>
                  <th className="px-3 py-2 font-medium">類別</th>
                  <th className="px-3 py-2 font-medium">科目代碼</th>
                  <th className="px-3 py-2 font-medium">科目名稱</th>
                  <th className="px-3 py-2 text-right font-medium">借方</th>
                  <th className="px-3 py-2 text-right font-medium">貸方</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">淨額（借−貸）</th>
                </tr>
              </thead>
              <tbody>
                {filteredTb.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      {hideZeroTb ? "無非零發生額科目" : "無科目資料"}
                    </td>
                  </tr>
                ) : (
                  filteredTb.map((r) => (
                    <tr
                      key={r.accountingItemId}
                      className="border-b border-zinc-100 dark:border-zinc-800/80 odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900/15 dark:even:bg-zinc-900/10"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{r.accountType}</td>
                      <td className="max-w-[140px] truncate px-3 py-2">{r.categoryCode}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.code}</td>
                      <td className="max-w-[200px] truncate px-3 py-2">{r.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.debit)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.credit)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">{fmtMoney(r.netDebit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 bg-zinc-100/90 font-semibold dark:border-zinc-600 dark:bg-zinc-800/70">
                  <td colSpan={4} className="px-3 py-2">
                    合計（全部科目）
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.trialTotals.debit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.trialTotals.credit)}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">—</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">記賬憑證（本年度）</h2>
            <div className="space-y-2">
              {data.journalEntries.length === 0 ? (
                <p className="text-sm text-zinc-500">尚無憑證。可使用「新增記賬憑證」建立複式分錄。</p>
              ) : (
                data.journalEntries.map((je) => (
                  <details
                    key={je.id}
                    className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-zinc-800 dark:text-zinc-100">{je.documentNo}</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{je.entryDate}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-500">{je.memo ?? "—"}</span>
                      </div>
                    </summary>
                    <div className="border-t border-zinc-100 px-4 pb-3 pt-1 dark:border-zinc-800">
                      <table className="w-full min-w-[560px] text-xs">
                        <thead>
                          <tr className="text-left text-zinc-500">
                            <th className="py-1">#</th>
                            <th className="py-1">科目</th>
                            <th className="py-1 text-right">借方</th>
                            <th className="py-1 text-right">貸方</th>
                            <th className="py-1">摘要</th>
                          </tr>
                        </thead>
                        <tbody>
                          {je.lines.map((ln) => (
                            <tr key={ln.lineNo} className="border-t border-zinc-50 dark:border-zinc-800/80">
                              <td className="py-1 tabular-nums">{ln.lineNo}</td>
                              <td className="py-1">
                                <span className="font-mono">{ln.itemCode}</span> {ln.itemName}
                              </td>
                              <td className="py-1 text-right tabular-nums">{ln.debit > 0 ? fmtMoney(ln.debit) : "—"}</td>
                              <td className="py-1 text-right tabular-nums">{ln.credit > 0 ? fmtMoney(ln.credit) : "—"}</td>
                              <td className="max-w-[200px] truncate py-1 text-zinc-500">{ln.lineMemo ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))
              )}
            </div>
          </section>

          <ul className="list-disc space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
            <li>{data.notes.chart}</li>
            <li>{data.notes.trialBalance}</li>
            <li>{data.notes.journal}</li>
          </ul>
        </>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetDraft(); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增記賬憑證</DialogTitle>
            <DialogDescription>借貸必須平衡；每行擇一填入借方或貸方金額。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="gl-entry-date">憑證日期</Label>
                <Input id="gl-entry-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gl-memo">備註（選填）</Label>
                <Input id="gl-memo" value={headerMemo} onChange={(e) => setHeaderMemo(e.target.value)} placeholder="例如：銀行利息收入" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>分錄明細</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraftLines((rows) => [...rows, { accountingItemId: "", debit: "", credit: "", lineMemo: "" }])
                  }
                >
                  新增一行
                </Button>
              </div>
              <div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                {draftLines.map((row, idx) => (
                  <div key={idx} className="grid gap-2 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label className="text-xs text-zinc-500">科目</Label>
                      <select
                        value={row.accountingItemId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftLines((rows) => rows.map((r, i) => (i === idx ? { ...r, accountingItemId: v } : r)));
                        }}
                        className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                      >
                        <option value="">選擇科目…</option>
                        {data?.chart.map((c) => (
                          <optgroup key={c.id} label={`${c.categoryCode} ${c.categoryName}`}>
                            {c.items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.code} — {i.name}
                                {!i.isActive ? "（停用）" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-zinc-500">借方</Label>
                      <Input
                        className="mt-1 tabular-nums"
                        inputMode="decimal"
                        value={row.debit}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftLines((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, debit: v, credit: v ? "" : r.credit } : r))
                          );
                        }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-zinc-500">貸方</Label>
                      <Input
                        className="mt-1 tabular-nums"
                        inputMode="decimal"
                        value={row.credit}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftLines((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, credit: v, debit: v ? "" : r.debit } : r))
                          );
                        }}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs text-zinc-500">行摘要</Label>
                      <Input
                        className="mt-1"
                        value={row.lineMemo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftLines((rows) => rows.map((r, i) => (i === idx ? { ...r, lineMemo: v } : r)));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {formErr ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitJournal()}>
              {submitting ? "過賬中…" : "過賬"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
