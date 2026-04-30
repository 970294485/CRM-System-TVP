"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_ALL = "__all__";
const CATEGORY_OPTIONS = [
  { value: "規章制度", label: "規章制度" },
  { value: "產品型錄", label: "產品型錄" },
  { value: "教育訓練", label: "教育訓練" },
  { value: "其他", label: "其他" },
] as const;

export type CompanyDocumentRow = {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  accessType: string;
  uploadedBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  uploaderName: string;
};

type UserOption = { id: string; name: string; email: string };

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDateTime(iso: Date | string | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
}

type Props = {
  currentUserId: string;
  /** super_admin / admin */
  isAdmin: boolean;
};

export function CompanyDocumentCenter({ currentUserId, isAdmin }: Props) {
  const [documents, setDocuments] = useState<CompanyDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_ALL);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>(CATEGORY_OPTIONS[0]!.value);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAccess, setUploadAccess] = useState<"PUBLIC" | "RESTRICTED">("PUBLIC");
  const [uploading, setUploading] = useState(false);

  const [permOpen, setPermOpen] = useState(false);
  const [permDoc, setPermDoc] = useState<CompanyDocumentRow | null>(null);
  const [permSearch, setPermSearch] = useState("");
  const [permUserOptions, setPermUserOptions] = useState<UserOption[]>([]);
  const [permLoadingUsers, setPermLoadingUsers] = useState(false);
  const [permSelected, setPermSelected] = useState<Set<string>>(new Set());
  const [permSaving, setPermSaving] = useState(false);
  const [permLoadingExisting, setPermLoadingExisting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchQ.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchQ]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (categoryFilter !== CATEGORY_ALL) params.set("category", categoryFilter);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/company-documents${q}`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: CompanyDocumentRow[];
        error?: string;
      };
      if (!res.ok) {
        setListError(data.error || `載入失敗（${res.status}）`);
        setDocuments([]);
        return;
      }
      setDocuments(data.items ?? []);
    } catch {
      setListError("網路錯誤");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, categoryFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const canShowAssign = useCallback(
    (row: CompanyDocumentRow) =>
      row.accessType === "RESTRICTED" && (isAdmin || row.uploadedBy === currentUserId),
    [isAdmin, currentUserId]
  );

  async function submitUpload() {
    const title = uploadTitle.trim();
    if (!title) {
      toast.error("請輸入標題");
      return;
    }
    if (!uploadFile) {
      toast.error("請選擇檔案");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("category", uploadCategory);
      fd.set("access_type", uploadAccess);
      fd.set("file", uploadFile);
      const res = await fetch("/api/company-documents", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "上傳失敗");
        return;
      }
      toast.success("已建立企業文檔（儲存路徑為預留 mock）");
      setUploadOpen(false);
      setUploadTitle("");
      setUploadFile(null);
      setUploadAccess("PUBLIC");
      await loadDocuments();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setUploading(false);
    }
  }

  const loadUserDirectory = useCallback(async (q: string) => {
    setPermLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "80");
      const res = await fetch(`/api/company-documents/users?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as { items?: UserOption[]; error?: string };
      if (!res.ok) {
        toast.error(data.error || "載入員工列表失敗");
        setPermUserOptions([]);
        return;
      }
      setPermUserOptions(data.items ?? []);
    } catch {
      toast.error("網路錯誤");
      setPermUserOptions([]);
    } finally {
      setPermLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!permOpen) return;
    const t = window.setTimeout(() => void loadUserDirectory(permSearch), permSearch.trim() ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [permOpen, permSearch, loadUserDirectory]);

  async function openPermDialog(doc: CompanyDocumentRow) {
    setPermDoc(doc);
    setPermSearch("");
    setPermSelected(new Set());
    setPermOpen(true);
    setPermLoadingExisting(true);
    try {
      const res = await fetch(`/api/company-documents/permissions?document_id=${encodeURIComponent(doc.id)}`);
      const data = (await res.json().catch(() => ({}))) as { user_ids?: string[]; error?: string };
      if (!res.ok) {
        toast.error(data.error || "無法載入現有權限");
        setPermOpen(false);
        return;
      }
      setPermSelected(new Set(data.user_ids ?? []));
    } catch {
      toast.error("網路錯誤");
      setPermOpen(false);
    } finally {
      setPermLoadingExisting(false);
    }
    void loadUserDirectory("");
  }

  function togglePermUser(id: string) {
    setPermSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function savePermissions() {
    if (!permDoc) return;
    setPermSaving(true);
    try {
      const res = await fetch("/api/company-documents/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: permDoc.id,
          user_ids: [...permSelected],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "儲存失敗");
        return;
      }
      toast.success("已更新內部授權名單");
      setPermOpen(false);
      setPermDoc(null);
    } catch {
      toast.error("網路錯誤");
    } finally {
      setPermSaving(false);
    }
  }

  const categorySelectItems = useMemo(
    () => [{ value: CATEGORY_ALL, label: "全部分類" }, ...CATEGORY_OPTIONS.map((c) => ({ ...c }))],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid min-w-[200px] flex-1 gap-2">
            <Label htmlFor="company-doc-search">搜尋標題</Label>
            <Input
              id="company-doc-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="關鍵字…"
              autoComplete="off"
            />
          </div>
          <div className="grid w-full min-w-[180px] gap-2 sm:w-52">
            <Label>檔案分類</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorySelectItems.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" className="shrink-0" onClick={() => setUploadOpen(true)}>
          上傳企業文檔
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        {loading ? (
          <p className="py-12 text-center text-sm text-zinc-500">載入中…</p>
        ) : listError ? (
          <p className="py-12 text-center text-sm text-red-600 dark:text-red-400">{listError}</p>
        ) : documents.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">尚無符合條件的文檔</p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="px-3 py-2 font-medium">文檔標題</th>
                <th className="px-3 py-2 font-medium">分類</th>
                <th className="px-3 py-2 font-medium">大小</th>
                <th className="px-3 py-2 font-medium">上傳時間</th>
                <th className="px-3 py-2 font-medium">存取</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                >
                  <td className="max-w-[200px] px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="line-clamp-2" title={row.title}>
                      {row.title}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                      {row.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {formatBytes(row.fileSize)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.accessType === "PUBLIC" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        <span aria-hidden>🌐</span>公開
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        <span aria-hidden>🔒</span>內部受限
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                        <a href={row.fileUrl} target="_blank" rel="noreferrer">
                          下載
                        </a>
                      </Button>
                      {canShowAssign(row) ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => void openPermDialog(row)}
                        >
                          <span aria-hidden>👥</span> 分配權限
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上傳企業文檔</DialogTitle>
            <DialogDescription>填寫標題、分類與存取範圍；實體檔案目前寫入預留 URL，可後續接上物件儲存。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cd-upload-title">標題</Label>
              <Input
                id="cd-upload-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="檔案標題／顯示名稱"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label>檔案分類</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cd-upload-file">選擇檔案</Label>
              <Input id="cd-upload-file" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <fieldset className="grid gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <legend className="px-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">權限設定</legend>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="cd-access"
                  className="mt-1"
                  checked={uploadAccess === "PUBLIC"}
                  onChange={() => setUploadAccess("PUBLIC")}
                />
                <span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">公開給全公司</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">全體員工可見（PUBLIC）</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="cd-access"
                  className="mt-1"
                  checked={uploadAccess === "RESTRICTED"}
                  onChange={() => setUploadAccess("RESTRICTED")}
                />
                <span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">僅限指定內部員工</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">需於列表中「分配權限」（RESTRICTED）</span>
                </span>
              </label>
            </fieldset>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={uploading} onClick={() => void submitUpload()}>
              {uploading ? "上傳中…" : "確認上傳"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分配內部權限</DialogTitle>
            <DialogDescription>
              {permDoc ? (
                <>
                  文檔「{permDoc.title}」— 勾選可存取此受限文檔的內部帳號，儲存後生效。
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="perm-user-search">搜尋員工</Label>
              <Input
                id="perm-user-search"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="姓名或信箱…"
                autoComplete="off"
              />
            </div>
            {permLoadingExisting ? (
              <p className="text-xs text-zinc-500">載入現有授權…</p>
            ) : permLoadingUsers ? (
              <p className="text-xs text-zinc-500">搜尋中…</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                {permUserOptions.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-zinc-500">無符合的員工</li>
                ) : (
                  permUserOptions.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800"
                    >
                      <input
                        type="checkbox"
                        id={`perm-${u.id}`}
                        checked={permSelected.has(u.id)}
                        onChange={() => togglePermUser(u.id)}
                        className="rounded border-zinc-300"
                      />
                      <label htmlFor={`perm-${u.id}`} className="min-w-0 flex-1 cursor-pointer text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{u.email}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="text-xs text-zinc-500">已選 {permSelected.size} 人</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPermOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={permSaving || permLoadingExisting} onClick={() => void savePermissions()}>
              {permSaving ? "儲存中…" : "儲存授權"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
