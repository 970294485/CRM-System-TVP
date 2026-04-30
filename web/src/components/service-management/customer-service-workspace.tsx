"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

type CustomerOption = { id: string; name: string; phone: string | null; email: string | null };

type CaseRow = {
  id: string;
  caseNo: string;
  customerId: string | null;
  customerNameSnapshot: string;
  title: string;
  category: string;
  channel: string;
  status: string;
  priority: string;
  summary: string | null;
  openedAt: string;
  updatedAt: string;
};

type CaseDetail = CaseRow & {
  assignedToUserId: string | null;
  createdByUserId: string | null;
};

type NoteRow = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  inquiry: "諮詢",
  complaint: "投訴",
  after_sales: "售後",
  billing: "帳務",
  other: "其他",
};

const CHANNEL_LABEL: Record<string, string> = {
  phone: "電話",
  email: "Email",
  line: "LINE",
  in_person: "親訪",
  online: "線上客服",
  other: "其他",
};

const STATUS_LABEL: Record<string, string> = {
  open: "待處理",
  in_progress: "處理中",
  resolved: "已解決",
  closed: "已結案",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function fmtDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CustomerServiceWorkspace() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [custQ, setCustQ] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [custHits, setCustHits] = useState<CustomerOption[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [newCustomerNameManual, setNewCustomerNameManual] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("inquiry");
  const [newChannel, setNewChannel] = useState("phone");
  const [newPriority, setNewPriority] = useState("medium");
  const [newSummary, setNewSummary] = useState("");
  const [newInitialNote, setNewInitialNote] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const [patchBusy, setPatchBusy] = useState(false);

  const loadCases = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set("status", statusFilter);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/customer-service/cases?${sp.toString()}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: CaseRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setListError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
        setCases([]);
        return;
      }
      setCases(Array.isArray(data.items) ? data.items : []);
    } catch {
      setListError("網路錯誤");
      setCases([]);
    } finally {
      setListLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadCases();
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, statusFilter, loadCases]);

  const fetchCustomers = useCallback(async (search: string) => {
    setCustLoading(true);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}&limit=30` : "?limit=30";
      const res = await fetch(`/api/sales/customers${qs}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: CustomerOption[] };
      setCustHits(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCustHits([]);
    } finally {
      setCustLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!createOpen || !custOpen) return;
    const t = setTimeout(() => {
      void fetchCustomers(custQ);
    }, 280);
    return () => clearTimeout(t);
  }, [custQ, createOpen, custOpen, fetchCustomers]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    setNotes([]);
    try {
      const res = await fetch(`/api/customer-service/cases/${id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        item?: CaseDetail;
        notes?: NoteRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setDetail(null);
        setNotes([]);
        return;
      }
      if (data.item) setDetail(data.item);
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setNotes([]);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const resetCreateForm = () => {
    setCustQ("");
    setNewCustomerId(null);
    setNewCustomerNameManual("");
    setNewTitle("");
    setNewCategory("inquiry");
    setNewChannel("phone");
    setNewPriority("medium");
    setNewSummary("");
    setNewInitialNote("");
    setCreateError(null);
    setCustOpen(false);
  };

  const submitCreate = async () => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/customer-service/cases", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: newCustomerId ?? undefined,
          customer_name_snapshot: newCustomerId ? undefined : newCustomerNameManual.trim() || undefined,
          title: newTitle.trim(),
          category: newCategory,
          channel: newChannel,
          priority: newPriority,
          summary: newSummary.trim() || null,
          initial_note: newInitialNote.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string; item?: { id: string } };
      if (!res.ok) {
        setCreateError([data.error, data.hint].filter(Boolean).join(" ") || "建立失敗");
        return;
      }
      setCreateOpen(false);
      resetCreateForm();
      await loadCases();
      if (data.item?.id) {
        setSelectedId(data.item.id);
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const submitNote = async () => {
    if (!selectedId || !noteDraft.trim()) return;
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/customer-service/cases/${selectedId}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim() }),
      });
      if (res.ok) {
        setNoteDraft("");
        void loadDetail(selectedId);
        void loadCases();
      }
    } finally {
      setNoteBusy(false);
    }
  };

  const patchCase = async (patch: Record<string, string>) => {
    if (!selectedId) return;
    setPatchBusy(true);
    try {
      const res = await fetch(`/api/customer-service/cases/${selectedId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        void loadDetail(selectedId);
        void loadCases();
      }
    } finally {
      setPatchBusy(false);
    }
  };

  const detailPanel =
    detail && !detailLoading ? (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-zinc-500">{detail.caseNo}</p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{detail.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              客戶：<span className="font-medium text-zinc-800 dark:text-zinc-200">{detail.customerNameSnapshot}</span>
              {detail.customerId ? (
                <span className="ml-2 font-mono text-xs text-zinc-500">({detail.customerId.slice(0, 8)}…)</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">狀態</Label>
            <Select
              value={detail.status}
              onValueChange={(v) => void patchCase({ status: v })}
              disabled={patchBusy}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, lab]) => (
                  <SelectItem key={k} value={k}>
                    {lab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">優先級</Label>
            <Select
              value={detail.priority}
              onValueChange={(v) => void patchCase({ priority: v })}
              disabled={patchBusy}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([k, lab]) => (
                  <SelectItem key={k} value={k}>
                    {lab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">類型</Label>
            <Select
              value={detail.category}
              onValueChange={(v) => void patchCase({ category: v })}
              disabled={patchBusy}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([k, lab]) => (
                  <SelectItem key={k} value={k}>
                    {lab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">管道</Label>
            <Select
              value={detail.channel}
              onValueChange={(v) => void patchCase({ channel: v })}
              disabled={patchBusy}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_LABEL).map(([k, lab]) => (
                  <SelectItem key={k} value={k}>
                    {lab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {detail.summary ? (
          <div>
            <Label className="text-xs text-zinc-500">案件摘要</Label>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{detail.summary}</p>
          </div>
        ) : null}

        <p className="text-xs text-zinc-400">
          建立 {fmtDt(detail.openedAt)} · 更新 {fmtDt(detail.updatedAt)}
        </p>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">備註紀錄</h3>
          <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <li className="text-sm text-zinc-500">尚無備註</li>
            ) : (
              notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{n.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {n.authorName ?? "系統"} · {fmtDt(n.createdAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="新增備註…"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="resize-y text-sm"
            />
            <Button type="button" size="sm" onClick={() => void submitNote()} disabled={noteBusy || !noteDraft.trim()}>
              {noteBusy ? "送出中…" : "新增備註"}
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">狀態篩選</Label>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, lab]) => (
                  <SelectItem key={k} value={k}>
                    {lab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">搜尋</Label>
            <Input
              className="h-9 w-[min(100%,16rem)]"
              placeholder="單號、主旨、客戶…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          新增案件
        </Button>
      </div>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {listError}
        </p>
      ) : null}

      <div className="grid min-h-[420px] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="crm-table-shell overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
          {listLoading ? (
            <p className="p-4 text-sm text-zinc-500">載入中…</p>
          ) : cases.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">尚無案件。可點「新增案件」開始錄入。</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <th className="px-3 py-3">單號</th>
                  <th className="px-3 py-3">客戶</th>
                  <th className="px-3 py-3">主旨</th>
                  <th className="px-3 py-3">狀態</th>
                  <th className="px-3 py-3">建立時間</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className={`cursor-pointer border-b border-zinc-100 dark:border-zinc-800/80 ${
                      selectedId === c.id ? "bg-blue-50/90 dark:bg-blue-950/40" : "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{c.caseNo}</td>
                    <td className="max-w-[8rem] truncate px-3 py-2" title={c.customerNameSnapshot}>
                      {c.customerNameSnapshot}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2" title={c.title}>
                      {c.title}
                    </td>
                    <td className="px-3 py-2 text-xs">{STATUS_LABEL[c.status] ?? c.status}</td>
                    <td className="px-3 py-2 tabular-nums text-xs text-zinc-500">{fmtDt(c.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="min-h-0 lg:sticky lg:top-0 lg:self-start">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">載入案件…</p>
          ) : selectedId && detailPanel ? (
            detailPanel
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30">
              請由左側選擇一筆案件以檢視詳情與備註。
            </p>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增客服案件</DialogTitle>
            <DialogDescription>連結客戶主檔或手動填寫客戶稱呼，並可選填首則備註。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative space-y-2">
              <Label>客戶（主檔搜尋）</Label>
              <Input
                placeholder="搜尋名稱、編號、電話…"
                value={custQ}
                onChange={(e) => {
                  setCustQ(e.target.value);
                  setCustOpen(true);
                }}
                onFocus={() => {
                  setCustOpen(true);
                  void fetchCustomers(custQ);
                }}
                autoComplete="off"
              />
              {custOpen ? (
                <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {custLoading ? (
                    <p className="px-3 py-2 text-sm text-zinc-500">載入中…</p>
                  ) : custHits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-500">無符合項目（可改用手動稱呼）</p>
                  ) : (
                    <ul className="py-1">
                      {custHits.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            onClick={() => {
                              setNewCustomerId(c.id);
                              setCustQ(c.name);
                              setNewCustomerNameManual("");
                              setCustOpen(false);
                            }}
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.phone ? <span className="ml-2 text-xs text-zinc-500">{c.phone}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>或手動客戶稱呼（未選主檔時必填）</Label>
              <Input
                value={newCustomerNameManual}
                onChange={(e) => {
                  setNewCustomerNameManual(e.target.value);
                  if (e.target.value.trim()) setNewCustomerId(null);
                }}
                placeholder="例如：來電訪客、非建檔公司名"
                disabled={!!newCustomerId}
              />
            </div>

            <div className="space-y-2">
              <Label>主旨</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="簡述問題或需求" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>類型</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, lab]) => (
                      <SelectItem key={k} value={k}>
                        {lab}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>管道</Label>
                <Select value={newChannel} onValueChange={setNewChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABEL).map(([k, lab]) => (
                      <SelectItem key={k} value={k}>
                        {lab}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>優先級</Label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, lab]) => (
                    <SelectItem key={k} value={k}>
                      {lab}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>案件摘要（選填）</Label>
              <Textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} rows={2} className="resize-y" />
            </div>

            <div className="space-y-2">
              <Label>首則備註（選填）</Label>
              <Textarea
                value={newInitialNote}
                onChange={(e) => setNewInitialNote(e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>

            {createError ? <p className="text-sm text-red-600 dark:text-red-400">{createError}</p> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={createBusy || !newTitle.trim()}>
              {createBusy ? "建立中…" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
