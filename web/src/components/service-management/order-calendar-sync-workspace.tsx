"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookingEv = {
  kind: "booking";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  staffName: string | null;
  staffEmail: string | null;
  venueName: string | null;
  caseNo: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
};

type CaseEv = {
  kind: "assigned_case_marker";
  id: string;
  caseNo: string;
  title: string;
  dayStartUtc: string;
  status: string;
  assignedToName: string | null;
  summary: string | null;
};

function fmtRange(isoStart: string, isoEnd: string): string {
  try {
    const o: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    };
    return `${new Date(isoStart).toLocaleString("zh-TW", o)} — ${new Date(isoEnd).toLocaleString("zh-TW", o)}`;
  } catch {
    return `${isoStart} — ${isoEnd}`;
  }
}

function fmtDayZh(isoDayStartUtc: string): string {
  try {
    return new Date(isoDayStartUtc).toLocaleDateString("zh-TW", {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoDayStartUtc;
  }
}

function defaultRangeUtc(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 21);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function OrderCalendarSyncWorkspace() {
  const init = useMemo(() => defaultRangeUtc(), []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingEv[]>([]);
  const [cases, setCases] = useState<CaseEv[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
        scope,
      });
      if (debouncedQ) qs.set("q", debouncedQ);
      const res = await fetch(`/api/service-management/calendar/events?${qs.toString()}`, {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { hint?: string }).hint ?? (data as { error?: string }).error ?? `HTTP ${res.status}`);
      setBookings((data as { bookings?: BookingEv[] }).bookings ?? []);
      setCases((data as { assignedCaseMarkers?: CaseEv[] }).assignedCaseMarkers ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBookings([]);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, scope, debouncedQ]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  async function downloadIcs() {
    try {
      const qs = new URLSearchParams({
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
        scope,
      });
      if (debouncedQ) qs.set("q", debouncedQ);
      const res = await fetch(`/api/service-management/calendar/export-ics?${qs.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { hint?: string }).hint ?? (data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dl;
      a.download = `crm-service-calendar-${scope}-${from}-${to}.ics`;
      a.click();
      URL.revokeObjectURL(dl);
      toast.success("已下載 .ics，可匯入 Google／Outlook／Apple 行事曆");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "下載失敗");
    }
  }

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [bookings]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">行事曆彙總與 ICS 同步</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          將「購買與預約」建立的<strong className="font-medium text-zinc-800 dark:text-zinc-200">服務時段預約</strong>
          ，與區間內曾更新過的<strong className="font-medium text-zinc-800 dark:text-zinc-200">指派客服案件</strong>
          合併檢視；可匯出標準 <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-800">.ics</code>{" "}
          供負責人匯入個人行事曆。對外<strong className="font-medium">雙向</strong>自動同步（Google／Microsoft OAuth）
          將由<strong className="font-medium">系統設定</strong>／通知模組後續擴充；
          事前提醒亦可透過<strong className="font-medium">模組 9</strong>
          以郵件或站內通知發送（本頁先提供資料彙總與 iCal 匯出）。
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="cal-from" className="text-xs">
              開始日（UTC 日界）
            </Label>
            <Input id="cal-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-44" />
          </div>
          <div>
            <Label htmlFor="cal-to" className="text-xs">
              結束日
            </Label>
            <Input id="cal-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-44" />
          </div>
          <div>
            <Label className="text-xs">範圍</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "all" | "mine")}>
              <SelectTrigger className="mt-1 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全員：所有預約＋區間指派節點</SelectItem>
                <SelectItem value="mine">僅本人：由我負責的預約與案件</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="cal-q" className="text-xs">
              預約標題關鍵字（選填）
            </Label>
            <Input id="cal-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="過濾服務預約標題" className="mt-1" />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fetchEvents()}>
            重新整理
          </Button>
          <Button type="button" size="sm" onClick={() => void downloadIcs()}>
            下載 ICS
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">服務預約（含客戶聯絡與場地）</h3>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">載入中…</p>
        ) : err ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : sortedBookings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">此區間無符合條件的服務預約。</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
                  <th className="pb-2 pr-3 font-medium">標題／時段</th>
                  <th className="pb-2 pr-3 font-medium">負責人</th>
                  <th className="pb-2 pr-3 font-medium">場地</th>
                  <th className="pb-2 pr-3 font-medium">案件</th>
                  <th className="pb-2 font-medium">聯絡</th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.title}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{fmtRange(row.startsAt, row.endsAt)}</div>
                      {row.notes ? (
                        <div className="mt-1 max-w-md text-xs text-zinc-600 dark:text-zinc-400">備註：{row.notes}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                      {row.staffName ?? "—"}
                      {row.staffEmail ? <span className="mt-0.5 block text-xs text-zinc-400">{row.staffEmail}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{row.venueName ?? "—"}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{row.caseNo ?? "—"}</td>
                    <td className="py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.customerPhone ?? "—"}
                      {row.customerEmail ? <span className="block">{row.customerEmail}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">指派案件節點（區間內最近一次更新）</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          用於對齊「負責人需掌握的待辦熱區」——以案件更新時間落在查詢區間內者為準；全日事件匯入 ICS 時落在該 UTC 日曆日。
        </p>
        {loading ? null : err ? null : cases.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">此區間無指派案件更新節點。</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {cases.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  【{c.caseNo}】{c.title}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  錨點日：{fmtDayZh(c.dayStartUtc)}　狀態：{c.status}　負責人：{c.assignedToName ?? "—"}
                </div>
                {c.summary ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{c.summary}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
