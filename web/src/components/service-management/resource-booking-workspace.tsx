"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type VenueRow = {
  id: string;
  name: string;
  venueType: string;
  capacity: number | null;
  locationNote: string | null;
  isActive: boolean;
};

type BookingRow = {
  id: string;
  title: string;
  customerServiceCaseId: string | null;
  staffUserId: string | null;
  venueId: string | null;
  startsAt: string;
  endsAt: string;
  purchaseNote: string | null;
  estimatedCostMinor: number | null;
  notes: string | null;
  createdAt: string;
  staffName: string | null;
  staffEmail: string | null;
  venueName: string | null;
  caseNo: string | null;
};

type UserHit = { id: string; name: string; email: string };

type CaseHit = { id: string; caseNo: string; title: string };

const VENUE_TYPE_OPTS: { value: string; label: string }[] = [
  { value: "room", label: "會議室" },
  { value: "bay", label: "工位／維修位" },
  { value: "event_space", label: "活動場地" },
  { value: "equipment", label: "設備" },
  { value: "other", label: "其他" },
];

const VENUE_TYPE_LABEL = Object.fromEntries(VENUE_TYPE_OPTS.map((o) => [o.value, o.label]));

function fmtRange(isoStart: string, isoEnd: string): string {
  try {
    const o: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    };
    const a = new Date(isoStart).toLocaleString("zh-TW", o);
    const b = new Date(isoEnd).toLocaleString("zh-TW", o);
    return `${a} — ${b}`;
  } catch {
    return `${isoStart} — ${isoEnd}`;
  }
}

function toDatetimeLocalValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return "";
  }
}

export function ResourceBookingWorkspace() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesErr, setVenuesErr] = useState<string | null>(null);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsErr, setBookingsErr] = useState<string | null>(null);

  const activeVenues = useMemo(() => venues.filter((v) => v.isActive), [venues]);

  const loadVenues = useCallback(async () => {
    setVenuesLoading(true);
    setVenuesErr(null);
    try {
      const res = await fetch("/api/service-management/venues");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setVenues((data as { items?: VenueRow[] }).items ?? []);
    } catch (e) {
      setVenuesErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVenuesLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsErr(null);
    try {
      const res = await fetch("/api/service-management/bookings?limit=100");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { hint?: string; error?: string }).hint ?? (data as { error?: string }).error ?? `HTTP ${res.status}`);
      setBookings((data as { items?: BookingRow[] }).items ?? []);
    } catch (e) {
      setBookingsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVenues();
    void loadBookings();
  }, [loadVenues, loadBookings]);

  /* ─── 場地 ─── */

  const [venueOpen, setVenueOpen] = useState(false);
  const [vName, setVName] = useState("");
  const [vType, setVType] = useState("room");
  const [vCap, setVCap] = useState("");
  const [vLoc, setVLoc] = useState("");
  const [venueSaving, setVenueSaving] = useState(false);

  async function submitVenue() {
    const capParsed = vCap.trim() === "" ? null : Number.parseInt(vCap, 10);
    if (vCap.trim() !== "" && (!Number.isFinite(capParsed) || capParsed! <= 0)) {
      toast.error("容量請填正整數或留空");
      return;
    }
    setVenueSaving(true);
    try {
      const res = await fetch("/api/service-management/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vName.trim(),
          venueType: vType,
          capacity: capParsed,
          locationNote: vLoc.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      toast.success("已新增場地");
      setVenueOpen(false);
      setVName("");
      setVType("room");
      setVCap("");
      setVLoc("");
      await loadVenues();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setVenueSaving(false);
    }
  }

  async function toggleVenueActive(row: VenueRow) {
    try {
      const res = await fetch(`/api/service-management/venues/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      toast.success(row.isActive ? "已停用場地" : "已啟用場地");
      await loadVenues();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失敗");
    }
  }

  /* ─── 預約 ─── */

  const [bookOpen, setBookOpen] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bStarts, setBStarts] = useState("");
  const [bEnds, setBEnds] = useState("");
  const [bVenueId, setBVenueId] = useState<string>("");
  const [bStaffId, setBStaffId] = useState<string | null>(null);
  const [bStaffLabel, setBStaffLabel] = useState("");
  const [bCaseId, setBCaseId] = useState<string>("");
  const [bPurchase, setBPurchase] = useState("");
  const [bCost, setBCost] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [bookSaving, setBookSaving] = useState(false);

  const [staffQ, setStaffQ] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffHits, setStaffHits] = useState<UserHit[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const staffDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cases, setCases] = useState<CaseHit[]>([]);

  useEffect(() => {
    if (!bookOpen) return;
    void (async () => {
      try {
        const res = await fetch("/api/customer-service/cases?limit=80");
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const items = (data as { items?: { id: string; caseNo: string; title: string }[] }).items ?? [];
          setCases(items.map((c) => ({ id: c.id, caseNo: c.caseNo, title: c.title })));
        } else setCases([]);
      } catch {
        setCases([]);
      }
    })();
  }, [bookOpen]);

  const searchStaff = useCallback((q: string) => {
    if (staffDebounceRef.current) clearTimeout(staffDebounceRef.current);
    staffDebounceRef.current = setTimeout(async () => {
      const t = q.trim();
      if (t.length < 1) {
        setStaffHits([]);
        setStaffLoading(false);
        return;
      }
      setStaffLoading(true);
      try {
        const res = await fetch(`/api/company-documents/users?q=${encodeURIComponent(t)}&limit=30`);
        const data = await res.json().catch(() => ({}));
        setStaffHits((data as { items?: UserHit[] }).items ?? []);
      } finally {
        setStaffLoading(false);
      }
    }, 280);
  }, []);

  function openBookingModal() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setBTitle("");
    setBStarts(toDatetimeLocalValue(start.toISOString()));
    setBEnds(toDatetimeLocalValue(end.toISOString()));
    setBVenueId("");
    setBStaffId(null);
    setBStaffLabel("");
    setStaffQ("");
    setStaffHits([]);
    setBCaseId("");
    setBPurchase("");
    setBCost("");
    setBNotes("");
    setBookOpen(true);
  }

  async function submitBooking() {
    const staffUserId = bStaffId;
    const venueId = bVenueId || null;
    if (!staffUserId && !venueId) {
      toast.error("請至少選擇負責員工或場地");
      return;
    }
    if (!bTitle.trim()) {
      toast.error("請填寫預約標題");
      return;
    }
    const s = new Date(bStarts);
    const e = new Date(bEnds);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      toast.error("時間格式不正確");
      return;
    }
    if (!(e > s)) {
      toast.error("結束時間必須晚於開始時間");
      return;
    }
    let costMinor: number | null = null;
    if (bCost.trim() !== "") {
      const n = Number.parseInt(bCost, 10);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("預估成本請填非負整數（最小貨幣單位）");
        return;
      }
      costMinor = n;
    }

    setBookSaving(true);
    try {
      const res = await fetch("/api/service-management/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bTitle.trim(),
          customerServiceCaseId: bCaseId || null,
          staffUserId,
          venueId,
          startsAt: s.toISOString(),
          endsAt: e.toISOString(),
          purchaseNote: bPurchase.trim() || null,
          estimatedCostMinor: costMinor,
          notes: bNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error((data as { error?: string }).error ?? "時段與現有預約衝突");
        return;
      }
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      toast.success("已建立預約");
      setBookOpen(false);
      await loadBookings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setBookSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">場地／設備主檔</h2>
          <Button type="button" size="sm" onClick={() => setVenueOpen(true)}>
            新增場地
          </Button>
        </div>
        {venuesLoading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : venuesErr ? (
          <p className="text-sm text-red-600 dark:text-red-400">{venuesErr}</p>
        ) : venues.length === 0 ? (
          <p className="text-sm text-zinc-500">尚未建立場地，請先新增以利預約分配。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                  <th className="pb-2 pr-3 font-medium">名稱</th>
                  <th className="pb-2 pr-3 font-medium">類型</th>
                  <th className="pb-2 pr-3 font-medium">容量</th>
                  <th className="pb-2 pr-3 font-medium">位置備註</th>
                  <th className="pb-2 pr-3 font-medium">狀態</th>
                  <th className="pb-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{row.name}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {VENUE_TYPE_LABEL[row.venueType] ?? row.venueType}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {row.capacity != null ? row.capacity : "—"}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {row.locationNote ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          row.isActive
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {row.isActive ? "啟用" : "停用"}
                      </span>
                    </td>
                    <td className="py-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleVenueActive(row)}>
                        {row.isActive ? "停用" : "啟用"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={venueOpen} onOpenChange={setVenueOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增場地</DialogTitle>
              <DialogDescription>建立會議室、工位或設備等資源，供預約時選用。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label htmlFor="v-name">名稱</Label>
                <Input id="v-name" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="例如：會議室 A" />
              </div>
              <div>
                <Label>類型</Label>
                <Select value={vType} onValueChange={setVType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPE_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="v-cap">預約容量上限（選填）</Label>
                <Input id="v-cap" inputMode="numeric" value={vCap} onChange={(e) => setVCap(e.target.value)} placeholder="例如：8" />
              </div>
              <div>
                <Label htmlFor="v-loc">位置／樓層備註</Label>
                <Input id="v-loc" value={vLoc} onChange={(e) => setVLoc(e.target.value)} placeholder="例如：總部 3F 東側" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVenueOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => void submitVenue()} disabled={venueSaving || !vName.trim()}>
                {venueSaving ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">預約紀錄</h2>
          <Button type="button" size="sm" onClick={openBookingModal}>
            新增預約
          </Button>
        </div>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          指派至少一位員工<strong className="font-medium">或</strong>一個場地；系統會阻擋同一員工或同一場地的重疊時段。
        </p>

        {bookingsLoading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : bookingsErr ? (
          <p className="text-sm text-red-600 dark:text-red-400">{bookingsErr}</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-zinc-500">尚無預約紀錄。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                  <th className="pb-2 pr-3 font-medium">標題</th>
                  <th className="pb-2 pr-3 font-medium">時段</th>
                  <th className="pb-2 pr-3 font-medium">員工</th>
                  <th className="pb-2 pr-3 font-medium">場地</th>
                  <th className="pb-2 pr-3 font-medium">案件</th>
                  <th className="pb-2 font-medium">加購／成本</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{row.title}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {fmtRange(row.startsAt, row.endsAt)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {row.staffName ? (
                        <span>
                          {row.staffName}
                          <span className="ml-1 text-xs text-zinc-400">{row.staffEmail}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{row.venueName ?? "—"}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{row.caseNo ?? "—"}</td>
                    <td className="max-w-[180px] py-2 text-zinc-600 dark:text-zinc-400">
                      {row.purchaseNote || row.estimatedCostMinor != null ? (
                        <span className="block truncate">
                          {row.purchaseNote ?? ""}
                          {row.estimatedCostMinor != null ? ` · ${row.estimatedCostMinor}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={bookOpen} onOpenChange={setBookOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增預約</DialogTitle>
              <DialogDescription>
                可連結現有客服案件；加購與預估成本欄位供日後與財務模組串接。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label htmlFor="b-title">標題</Label>
                <Input id="b-title" value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="例如：到府安裝 — 張先生" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="b-start">開始</Label>
                  <Input id="b-start" type="datetime-local" value={bStarts} onChange={(e) => setBStarts(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="b-end">結束</Label>
                  <Input id="b-end" type="datetime-local" value={bEnds} onChange={(e) => setBEnds(e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="b-venue">場地（可與員工並用）</Label>
                <Select value={bVenueId || "__none__"} onValueChange={(v) => setBVenueId(v === "__none__" ? "" : v)}>
                  <SelectTrigger id="b-venue" className="mt-1">
                    <SelectValue placeholder="不指定場地" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不指定場地</SelectItem>
                    {activeVenues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Label htmlFor="b-staff">負責員工（可與場地並用）</Label>
                <Input
                  id="b-staff"
                  value={staffQ}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStaffQ(v);
                    if (bStaffId) {
                      setBStaffId(null);
                      setBStaffLabel("");
                    }
                    searchStaff(v);
                  }}
                  onFocus={() => setStaffOpen(true)}
                  placeholder="輸入姓名或 Email 搜尋…"
                  className="mt-1"
                />
                {bStaffId ? (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">已選：{bStaffLabel}</p>
                ) : null}
                {staffOpen && staffHits.length > 0 ? (
                  <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                    {staffHits.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setBStaffId(u.id);
                            setBStaffLabel(`${u.name}（${u.email}）`);
                            setStaffQ(u.name);
                            setStaffOpen(false);
                          }}
                        >
                          {u.name}{" "}
                          <span className="text-zinc-400">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {staffLoading ? <p className="mt-1 text-xs text-zinc-400">搜尋中…</p> : null}
              </div>

              <div>
                <Label htmlFor="b-case">關聯客服案件（選填）</Label>
                <Select value={bCaseId || "__none__"} onValueChange={(v) => setBCaseId(v === "__none__" ? "" : v)}>
                  <SelectTrigger id="b-case" className="mt-1">
                    <SelectValue placeholder="不關聯" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不關聯案件</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.caseNo} — {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="b-purchase">加購／耗材說明</Label>
                <Textarea
                  id="b-purchase"
                  value={bPurchase}
                  onChange={(e) => setBPurchase(e.target.value)}
                  rows={2}
                  placeholder="例如：耗材包 x1、延長線"
                />
              </div>

              <div>
                <Label htmlFor="b-cost">預估成本（最小貨幣單位，選填）</Label>
                <Input id="b-cost" inputMode="numeric" value={bCost} onChange={(e) => setBCost(e.target.value)} placeholder="例如：500（分）" />
              </div>

              <div>
                <Label htmlFor="b-notes">內部備註</Label>
                <Textarea id="b-notes" value={bNotes} onChange={(e) => setBNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBookOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => void submitBooking()} disabled={bookSaving}>
                {bookSaving ? "建立中…" : "建立預約"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
