"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PT_ACCOUNT_TYPES,
  ptAccountingCategoryLabels,
  type PtAccountType,
} from "@/lib/validations/pt-accounting-category";

export type PtAccountingCategoryRow = {
  id: string;
  category_code: string;
  category_name: string;
  account_type: string;
  description: string | null;
  is_active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
};

type ModalState =
  | null
  | { type: "create" }
  | { type: "view"; row: PtAccountingCategoryRow }
  | { type: "edit"; row: PtAccountingCategoryRow }
  | { type: "delete"; row: PtAccountingCategoryRow };

type Props = {
  editable: boolean;
};

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
}

export function AccountingCategoryManager({ editable }: Props) {
  const [items, setItems] = useState<PtAccountingCategoryRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | PtAccountType>("all");
  const [modal, setModal] = useState<ModalState>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<PtAccountType | "">("");
  const [formDesc, setFormDesc] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formSort, setFormSort] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/accounting-categories");
      const data = (await res.json().catch(() => ({}))) as { items?: PtAccountingCategoryRow[]; error?: string };
      if (!res.ok) {
        setListError(data.error || `載入失敗（${res.status}）`);
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
    setFormCode("");
    setFormName("");
    setFormType("");
    setFormDesc("");
    setFormActive(true);
    setFormSort(0);
  };

  useEffect(() => {
    if (!modal) return;
    if (modal.type === "create") {
      resetCreateForm();
    }
    if (modal.type === "edit") {
      const r = modal.row;
      setFormCode(r.category_code);
      setFormName(r.category_name);
      setFormType(r.account_type as PtAccountType);
      setFormDesc(r.description ?? "");
      setFormActive(r.is_active);
      setFormSort(Number(r.sort_order ?? 0));
    }
  }, [modal]);

  const filteredItems = useMemo(() => {
    if (filterType === "all") return items;
    return items.filter((r) => r.account_type === filterType);
  }, [items, filterType]);

  const openCreate = () => {
    setModal({ type: "create" });
  };

  const closeModal = () => {
    setModal(null);
  };

  const onCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || saving) return;
    if (!formType) {
      toast.error("請選擇會計類別");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/accounting-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_code: formCode,
          category_name: formName,
          account_type: formType,
          description: formDesc.trim() ? formDesc : null,
          is_active: formActive,
          sort_order: formSort,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `儲存失敗（${res.status}）`);
        return;
      }
      toast.success("科目已新增");
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
    if (!formType) {
      toast.error("請選擇會計類別");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/accounting-categories/${modal.row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_code: formCode,
          category_name: formName,
          account_type: formType,
          description: formDesc.trim() ? formDesc : null,
          is_active: formActive,
          sort_order: formSort,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `更新失敗（${res.status}）`);
        return;
      }
      toast.success("科目已更新");
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
      const res = await fetch(`/api/accounting-categories/${modal.row.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || `刪除失敗（${res.status}）`);
        return;
      }
      toast.success("科目已刪除");
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
            <CardTitle>會計科目</CardTitle>
            <CardDescription>表格檢視；使用彈窗新增、查看、編輯或刪除（刪除前若仍有入賬項目將無法刪除）。</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only" htmlFor="filter-acct-type">
              篩選類別
            </Label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | PtAccountType)}>
              <SelectTrigger id="filter-acct-type" className="w-[200px]">
                <SelectValue placeholder="篩選" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類別</SelectItem>
                {PT_ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ptAccountingCategoryLabels[t]} ({t})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadList()} disabled={loadingList}>
              重新整理
            </Button>
            {editable ? (
              <Button type="button" size="sm" onClick={openCreate}>
                新增科目
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {listError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
          ) : loadingList ? (
            <p className="text-sm text-zinc-500">載入中…</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {items.length === 0 ? "尚無科目，請新增。" : "此篩選下沒有資料。"}
            </p>
          ) : (
            <div className="crm-table-shell overflow-hidden">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <th className="px-3 py-3 text-right tabular-nums">排序</th>
                    <th className="px-3 py-3">科目代碼</th>
                    <th className="px-3 py-3">名稱</th>
                    <th className="px-3 py-3">會計類別</th>
                    <th className="px-3 py-3">說明</th>
                    <th className="px-3 py-3">狀態</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {r.sort_order ?? 0}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">{r.category_code}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.category_name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        <span className="font-mono text-xs">{r.account_type}</span>
                        <span className="ml-1 text-zinc-500">
                          {ptAccountingCategoryLabels[r.account_type as PtAccountType] ?? ""}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        <span className="line-clamp-2" title={r.description ?? undefined}>
                          {r.description || "—"}
                        </span>
                      </td>
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
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setModal({ type: "view", row: r })}>
                            查看
                          </Button>
                          {editable ? (
                            <>
                              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setModal({ type: "edit", row: r })}>
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

      {/* 新增 */}
      <Dialog open={modal?.type === "create"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增科目</DialogTitle>
            <DialogDescription>填寫後儲存；科目代碼全表唯一。</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-code">科目代碼 *</Label>
              <Input id="c-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} required placeholder="例如 1000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-name">科目名稱 *</Label>
              <Input id="c-name" value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="例如 現金" />
            </div>
            <div className="space-y-2">
              <Label>會計類別 *</Label>
              <Select value={formType || undefined} onValueChange={(v) => setFormType(v as PtAccountType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇類別" />
                </SelectTrigger>
                <SelectContent>
                  {PT_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ptAccountingCategoryLabels[t]} ({t})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-sort">排序（數字越小越靠前）</Label>
              <Input id="c-sort" type="number" min={0} value={formSort} onChange={(e) => setFormSort(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">說明／報銷規範</Label>
              <Textarea id="c-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="選填" />
            </div>
            <div className="flex items-center gap-2">
              <input id="c-active" type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
              <Label htmlFor="c-active" className="font-normal">
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

      {/* 查看 */}
      <Dialog open={!!viewRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>科目詳情</DialogTitle>
            <DialogDescription>唯讀檢視。</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500">科目代碼</dt>
                <dd className="font-mono">{viewRow.category_code}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">名稱</dt>
                <dd className="font-medium">{viewRow.category_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">會計類別</dt>
                <dd>
                  {viewRow.account_type} — {ptAccountingCategoryLabels[viewRow.account_type as PtAccountType] ?? viewRow.account_type}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">排序</dt>
                <dd>{viewRow.sort_order ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">說明</dt>
                <dd className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{viewRow.description || "—"}</dd>
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

      {/* 編輯 */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>編輯科目</DialogTitle>
            <DialogDescription>修改後儲存；若變更代碼請勿與其他筆重複。</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <form onSubmit={onEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e-code">科目代碼 *</Label>
                <Input id="e-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-name">科目名稱 *</Label>
                <Input id="e-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>會計類別 *</Label>
                <Select value={formType || undefined} onValueChange={(v) => setFormType(v as PtAccountType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇類別" />
                  </SelectTrigger>
                  <SelectContent>
                    {PT_ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ptAccountingCategoryLabels[t]} ({t})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-sort">排序</Label>
                <Input id="e-sort" type="number" min={0} value={formSort} onChange={(e) => setFormSort(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-desc">說明／報銷規範</Label>
                <Textarea id="e-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input id="e-active" type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
                <Label htmlFor="e-active" className="font-normal">
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

      {/* 刪除確認 */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>刪除科目</DialogTitle>
            <DialogDescription>
              確定刪除「{deleteRow?.category_code} — {deleteRow?.category_name}」？若此類別下仍有入賬項目，系統將拒絕刪除。
            </DialogDescription>
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
