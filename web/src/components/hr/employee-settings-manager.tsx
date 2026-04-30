"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EmployeeSettingsRow = {
  id: string;
  employee_name: string;
  department: string | null;
  base_salary: string | null;
  commission_rate: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ModalState =
  | null
  | { type: "create" }
  | { type: "view"; row: EmployeeSettingsRow }
  | { type: "edit"; row: EmployeeSettingsRow }
  | { type: "delete"; row: EmployeeSettingsRow };

type Props = {
  editable: boolean;
};

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const m = /^(\d{2}:\d{2})(?::\d{2})?/.exec(t);
  return m ? m[1]! : t;
}

function formatMoney(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCommission(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return `${(n * 100).toFixed(2)}%（${n}）`;
}

export function EmployeeSettingsManager({ editable }: Props) {
  const [items, setItems] = useState<EmployeeSettingsRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const [formName, setFormName] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formBase, setFormBase] = useState("");
  const [formCommission, setFormCommission] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/employee-settings");
      const data = (await res.json().catch(() => ({}))) as { items?: EmployeeSettingsRow[]; error?: string; hint?: string };
      if (!res.ok) {
        setListError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setListError("網路錯誤");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const resetCreateForm = () => {
    setFormName("");
    setFormDept("");
    setFormBase("");
    setFormCommission("");
    setFormStart("");
    setFormEnd("");
    setFormActive(true);
  };

  useEffect(() => {
    if (!modal) return;
    if (modal.type === "create") {
      resetCreateForm();
    }
    if (modal.type === "edit") {
      const r = modal.row;
      setFormName(r.employee_name);
      setFormDept(r.department ?? "");
      setFormBase(r.base_salary ?? "");
      setFormCommission(r.commission_rate ?? "");
      setFormStart(formatTime(r.work_start_time) === "—" ? "" : formatTime(r.work_start_time));
      setFormEnd(formatTime(r.work_end_time) === "—" ? "" : formatTime(r.work_end_time));
      setFormActive(r.is_active);
    }
  }, [modal]);

  const closeModal = () => setModal(null);

  const payloadBody = () => ({
    employee_name: formName,
    department: formDept.trim() ? formDept.trim() : null,
    base_salary: formBase.trim() === "" ? null : formBase.trim(),
    commission_rate: formCommission.trim() === "" ? null : formCommission.trim(),
    work_start_time: formStart.trim() === "" ? null : formStart.trim(),
    work_end_time: formEnd.trim() === "" ? null : formEnd.trim(),
    is_active: formActive,
  });

  const onCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/employee-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody()),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `儲存失敗（${res.status}）`);
        return;
      }
      toast.success("員工設置已新增");
      closeModal();
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setSaving(false);
    }
  };

  const onEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || saving || modal?.type !== "edit") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employee-settings/${modal.row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody()),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `更新失敗（${res.status}）`);
        return;
      }
      toast.success("員工設置已更新");
      closeModal();
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirm = async () => {
    if (!editable || deleting || modal?.type !== "delete") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/employee-settings/${modal.row.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `刪除失敗（${res.status}）`);
        return;
      }
      toast.success("已刪除");
      closeModal();
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setDeleting(false);
    }
  };

  const viewRow = modal?.type === "view" ? modal.row : null;
  const editRow = modal?.type === "edit" ? modal.row : null;
  const deleteRow = modal?.type === "delete" ? modal.row : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>員工薪資與考勤</CardTitle>
            <CardDescription>表格檢視；使用彈窗新增、查看、編輯或刪除。</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadList()} disabled={loadingList}>
              重新整理
            </Button>
            {editable ? (
              <Button type="button" size="sm" onClick={() => setModal({ type: "create" })}>
                新增員工
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {listError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
          ) : loadingList ? (
            <p className="text-sm text-zinc-500">載入中…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無資料，請新增。</p>
          ) : (
            <div className="crm-table-shell overflow-hidden">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <th className="px-3 py-3">姓名</th>
                    <th className="px-3 py-3">部門</th>
                    <th className="px-3 py-3 text-right">底薪</th>
                    <th className="px-3 py-3 text-right">佣金比例</th>
                    <th className="px-3 py-3">上班</th>
                    <th className="px-3 py-3">下班</th>
                    <th className="px-3 py-3">狀態</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.employee_name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{r.department || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatMoney(r.base_salary)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-600 dark:text-zinc-400">
                        {formatCommission(r.commission_rate)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">{formatTime(r.work_start_time)}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">{formatTime(r.work_end_time)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            r.is_active
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }
                        >
                          {r.is_active ? "啟用" : "停用"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setModal({ type: "view", row: r })}
                          >
                            查看
                          </Button>
                          {editable ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setModal({ type: "edit", row: r })}
                              >
                                編輯
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                                onClick={() => setModal({ type: "delete", row: r })}
                              >
                                刪除
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal?.type === "create"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增員工設置</DialogTitle>
            <DialogDescription>薪資、佣金（0–1，如 0.05 為 5%）與標準上下班時間。</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hr-name">員工姓名 *</Label>
              <Input id="hr-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-dept">部門</Label>
              <Input id="hr-dept" value={formDept} onChange={(e) => setFormDept(e.target.value)} placeholder="選填" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-base">底薪</Label>
              <Input id="hr-base" inputMode="decimal" value={formBase} onChange={(e) => setFormBase(e.target.value)} placeholder="選填" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-comm">佣金比例（0–1）</Label>
              <Input
                id="hr-comm"
                inputMode="decimal"
                value={formCommission}
                onChange={(e) => setFormCommission(e.target.value)}
                placeholder="例如 0.05"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hr-start">上班時間</Label>
                <Input id="hr-start" value={formStart} onChange={(e) => setFormStart(e.target.value)} placeholder="09:00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hr-end">下班時間</Label>
                <Input id="hr-end" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} placeholder="18:00" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="hr-active"
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="hr-active" className="font-normal">
                啟用
              </Label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeModal}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>員工詳情</DialogTitle>
            <DialogDescription>唯讀檢視。</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500">姓名</dt>
                <dd className="font-medium">{viewRow.employee_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">部門</dt>
                <dd>{viewRow.department || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">底薪</dt>
                <dd>{formatMoney(viewRow.base_salary)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">佣金比例</dt>
                <dd>{formatCommission(viewRow.commission_rate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">標準上下班</dt>
                <dd className="tabular-nums">
                  {formatTime(viewRow.work_start_time)} — {formatTime(viewRow.work_end_time)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">狀態</dt>
                <dd>{viewRow.is_active ? "啟用" : "停用"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">建立 / 更新</dt>
                <dd className="text-xs text-zinc-600 dark:text-zinc-400">
                  {formatDateTime(viewRow.created_at)} · {formatDateTime(viewRow.updated_at)}
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={closeModal}>
              關閉
            </Button>
            {editable && viewRow ? (
              <Button type="button" onClick={() => setModal({ type: "edit", row: viewRow })}>
                改為編輯
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>編輯員工設置</DialogTitle>
            <DialogDescription>修改後儲存。</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <form onSubmit={onEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="he-name">員工姓名 *</Label>
                <Input id="he-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="he-dept">部門</Label>
                <Input id="he-dept" value={formDept} onChange={(e) => setFormDept(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="he-base">底薪</Label>
                <Input id="he-base" inputMode="decimal" value={formBase} onChange={(e) => setFormBase(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="he-comm">佣金比例（0–1）</Label>
                <Input id="he-comm" inputMode="decimal" value={formCommission} onChange={(e) => setFormCommission(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="he-start">上班時間</Label>
                  <Input id="he-start" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="he-end">下班時間</Label>
                  <Input id="he-end" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="he-active"
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="he-active" className="font-normal">
                  啟用
                </Label>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeModal}>
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "儲存中…" : "儲存變更"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>刪除員工設置</DialogTitle>
            <DialogDescription>確定刪除「{deleteRow?.employee_name}」？此動作無法復原。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeModal} disabled={deleting}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onDeleteConfirm()} disabled={deleting}>
              {deleting ? "刪除中…" : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
