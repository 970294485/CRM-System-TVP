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
import { Textarea } from "@/components/ui/textarea";
import { PERSONAL_DRIVE_ENTITY_TYPE } from "@/lib/personal-drive";

export { PERSONAL_DRIVE_ENTITY_TYPE };

export type DocumentCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
};

export type SystemDocumentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  categoryId: string;
  categoryName: string;
  entityType: string | null;
  entityId: string | null;
  fileSize: number;
  mimeType: string | null;
  createdAt: Date | string;
  sharePermission?: "view" | "download" | null;
  sharedByUserId?: string | null;
  sharedByName?: string | null;
  sharedByEmail?: string | null;
  sharedAt?: Date | string;
};

const ENTITY_MODULES: { value: string; label: string }[] = [
  { value: "CUSTOMER", label: "客戶 (CUSTOMER)" },
  { value: "QUOTATION", label: "報價單 (QUOTATION)" },
  { value: "PURCHASE_ORDER", label: "採購單 (PURCHASE_ORDER)" },
];

function entityModuleLabel(code: string | null | undefined): string {
  if (!code) return "—";
  if (code === PERSONAL_DRIVE_ENTITY_TYPE) return "個人網盤";
  const hit = ENTITY_MODULES.find((m) => m.value === code);
  return hit ? hit.label.split(" (")[0]! : code;
}

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

function sharePermissionLabel(p: string): string {
  if (p === "download") return "可下載";
  if (p === "view") return "僅檢視";
  return p || "—";
}

type Props = {
  editable: boolean;
  /** `personal`：僅列出／上傳綁定至目前使用者的個人空間（PERSONAL_DRIVE + userId） */
  mode?: "library" | "personal";
  /** `mode === "personal"` 時必填，為登入者 `users.id` */
  personalUserId?: string;
};

const ALL_KEY = "__all__";

export function DocumentClassificationManager({
  editable,
  mode = "library",
  personalUserId,
}: Props) {
  const isPersonal = mode === "personal";
  const personalUid = personalUserId?.trim() ?? "";
  const [personalTab, setPersonalTab] = useState<"mine" | "shared">("mine");
  const [categories, setCategories] = useState<DocumentCategoryRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_KEY);
  const [documents, setDocuments] = useState<SystemDocumentRow[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("");
  const [uploadEntityModule, setUploadEntityModule] = useState<string>("");
  const [uploadEntityRef, setUploadEntityRef] = useState("");
  const [uploading, setUploading] = useState(false);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<SystemDocumentRow | null>(null);
  const [shareList, setShareList] = useState<
    {
      id: string;
      sharedWithUserId: string;
      permission: string;
      createdAt: Date | string;
      userName: string;
      userEmail: string;
    }[]
  >([]);
  const [shareListLoading, setShareListLoading] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState("");
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchHits, setUserSearchHits] = useState<{ id: string; name: string; email: string }[]>([]);
  const [pickUser, setPickUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [sharePermissionPick, setSharePermissionPick] = useState<"view" | "download">("download");
  const [shareSaving, setShareSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    setCatsError(null);
    try {
      const res = await fetch("/api/document-categories");
      const data = (await res.json().catch(() => ({}))) as {
        items?: DocumentCategoryRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setCatsError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
        setCategories([]);
        return;
      }
      setCategories(data.items ?? []);
    } catch {
      setCatsError("網路錯誤");
      setCategories([]);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (isPersonal && !personalUid) {
      setLoadingDocs(false);
      setDocuments([]);
      setDocsError(null);
      return;
    }
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategoryId !== ALL_KEY) {
        params.set("category_id", selectedCategoryId);
      }
      if (isPersonal && personalTab === "shared") {
        params.set("shared_with_me", "1");
      } else if (isPersonal) {
        params.set("entity_type", PERSONAL_DRIVE_ENTITY_TYPE);
        params.set("entity_id", personalUid);
      }
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/documents${q}`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: SystemDocumentRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setDocsError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
        setDocuments([]);
        return;
      }
      setDocuments(data.items ?? []);
    } catch {
      setDocsError("網路錯誤");
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedCategoryId, isPersonal, personalUid, personalTab]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const sidebarItems = useMemo(() => {
    const entries = categories.map((c) => ({
      id: c.id,
      label: c.name,
    }));
    return [{ id: ALL_KEY, label: "全部文件" }, ...entries];
  }, [categories]);

  const loadShareList = useCallback(async (docId: string) => {
    setShareListLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/share`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: {
          id: string;
          sharedWithUserId: string;
          permission: string;
          createdAt: Date | string;
          userName: string;
          userEmail: string;
        }[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(" ") || "無法載入分享名單");
        setShareList([]);
        return;
      }
      setShareList(data.items ?? []);
    } catch {
      toast.error("網路錯誤");
      setShareList([]);
    } finally {
      setShareListLoading(false);
    }
  }, []);

  function openShareDialog(row: SystemDocumentRow) {
    setShareDoc(row);
    setUserSearchQ("");
    setUserSearchHits([]);
    setPickUser(null);
    setSharePermissionPick("download");
    setShareDialogOpen(true);
    void loadShareList(row.id);
  }

  async function revokeShare(targetUserId: string) {
    if (!shareDoc) return;
    try {
      const res = await fetch(
        `/api/documents/${shareDoc.id}/share?user_id=${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "取消失敗");
        return;
      }
      toast.success("已取消分享");
      await loadShareList(shareDoc.id);
      void loadDocuments();
    } catch {
      toast.error("網路錯誤");
    }
  }

  async function submitShare() {
    if (!shareDoc || !pickUser) {
      toast.error("請先選擇使用者");
      return;
    }
    setShareSaving(true);
    try {
      const res = await fetch(`/api/documents/${shareDoc.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shared_with_user_id: pickUser.id,
          permission: sharePermissionPick,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(" ") || "分享失敗");
        return;
      }
      toast.success("已更新分享");
      setPickUser(null);
      setUserSearchQ("");
      setUserSearchHits([]);
      await loadShareList(shareDoc.id);
    } catch {
      toast.error("網路錯誤");
    } finally {
      setShareSaving(false);
    }
  }

  useEffect(() => {
    if (!shareDialogOpen) return;
    const q = userSearchQ.trim();
    if (q.length < 1) {
      setUserSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setUserSearchLoading(true);
        try {
          const res = await fetch(`/api/company-documents/users?q=${encodeURIComponent(q)}&limit=20`);
          const data = (await res.json().catch(() => ({}))) as {
            items?: { id: string; name: string; email: string }[];
          };
          if (!res.ok) {
            setUserSearchHits([]);
            return;
          }
          const items = (data.items ?? []).filter((u) => u.id !== personalUid);
          setUserSearchHits(items);
        } catch {
          setUserSearchHits([]);
        } finally {
          setUserSearchLoading(false);
        }
      })();
    }, 320);
    return () => window.clearTimeout(t);
  }, [userSearchQ, shareDialogOpen, personalUid]);

  async function submitNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("請輸入分類名稱");
      return;
    }
    setSavingCategory(true);
    try {
      const res = await fetch("/api/document-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newCategoryDesc.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: DocumentCategoryRow };
      if (!res.ok) {
        toast.error(data.error || "新增失敗");
        return;
      }
      toast.success("已新增分類");
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryDesc("");
      await loadCategories();
      if (data.item?.id) {
        setSelectedCategoryId(data.item.id);
      }
    } catch {
      toast.error("網路錯誤");
    } finally {
      setSavingCategory(false);
    }
  }

  async function submitUpload() {
    if (!uploadFile) {
      toast.error("請選擇檔案");
      return;
    }
    if (!uploadCategoryId) {
      toast.error("請選擇分類");
      return;
    }
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("category_id", uploadCategoryId);
    if (isPersonal) {
      fd.append("entity_type", PERSONAL_DRIVE_ENTITY_TYPE);
      fd.append("entity_id", personalUid);
    } else {
      fd.append("entity_type", uploadEntityModule.trim());
      fd.append("entity_id", uploadEntityRef.trim());
    }

    setUploading(true);
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(data.error || "上傳失敗");
        return;
      }
      toast.success("上傳成功");
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadCategoryId(selectedCategoryId !== ALL_KEY ? selectedCategoryId : "");
      setUploadEntityModule("");
      setUploadEntityRef("");
      await loadDocuments();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (uploadDialogOpen && categories.length > 0 && !uploadCategoryId) {
      const fallback =
        selectedCategoryId !== ALL_KEY ? selectedCategoryId : categories[0]?.id ?? "";
      setUploadCategoryId(fallback);
    }
  }, [uploadDialogOpen, categories, selectedCategoryId, uploadCategoryId]);

  if (isPersonal && !personalUid) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">個人網盤模式缺少使用者 ID，無法載入。</p>
    );
  }

  return (
    <div className="flex min-h-[420px] flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90 lg:w-56">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">分類導覽</p>
          {editable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => setCategoryDialogOpen(true)}
            >
              + 新增分類
            </Button>
          ) : null}
        </div>
        {loadingCats ? (
          <p className="py-4 text-xs text-zinc-500">載入中…</p>
        ) : catsError ? (
          <p className="py-2 text-xs text-red-600 dark:text-red-400">{catsError}</p>
        ) : (
          <ul className="space-y-0.5">
            {sidebarItems.map((item) => {
              const active = selectedCategoryId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(item.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <span aria-hidden>📂</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {isPersonal
                ? personalTab === "mine"
                  ? "我的文件"
                  : "與我分享"
                : "文件列表"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isPersonal
                ? personalTab === "shared"
                  ? selectedCategoryId === ALL_KEY
                    ? "其他同事分享給您的個人網盤檔案"
                    : `與我分享 · ${categories.find((c) => c.id === selectedCategoryId)?.name ?? ""}`
                  : selectedCategoryId === ALL_KEY
                    ? "僅顯示您個人網盤中的檔案"
                    : `個人網盤 · ${categories.find((c) => c.id === selectedCategoryId)?.name ?? ""}`
                : selectedCategoryId === ALL_KEY
                  ? "顯示所有分類下的文件"
                  : `篩選：${categories.find((c) => c.id === selectedCategoryId)?.name ?? ""}`}
            </p>
            {isPersonal ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={personalTab === "mine" ? "default" : "outline"}
                  onClick={() => setPersonalTab("mine")}
                >
                  我的文件
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={personalTab === "shared" ? "default" : "outline"}
                  onClick={() => setPersonalTab("shared")}
                >
                  與我分享
                </Button>
              </div>
            ) : null}
          </div>
          {editable && (!isPersonal || personalTab === "mine") ? (
            <Button
              type="button"
              size="sm"
              disabled={categories.length === 0}
              title={categories.length === 0 ? "請先新增至少一個文件分類" : undefined}
              onClick={() => setUploadDialogOpen(true)}
            >
              上傳文件
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto px-2 pb-4 pt-2">
          {loadingDocs ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">載入文件…</p>
          ) : docsError ? (
            <p className="px-2 py-8 text-center text-sm text-red-600 dark:text-red-400">{docsError}</p>
          ) : documents.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">此檢視下尚無文件</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                  <th className="px-3 py-2 font-medium">檔案名稱</th>
                  <th className="px-3 py-2 font-medium">所屬分類</th>
                  <th className="px-3 py-2 font-medium">關聯模塊</th>
                  <th className="px-3 py-2 font-medium">檔案大小</th>
                  <th className="px-3 py-2 font-medium">上傳時間</th>
                  {isPersonal && personalTab === "shared" ? (
                    <>
                      <th className="px-3 py-2 font-medium">分享者</th>
                      <th className="px-3 py-2 font-medium">權限</th>
                    </>
                  ) : null}
                  {isPersonal ? <th className="px-3 py-2 font-medium">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {documents.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <td className="max-w-[220px] truncate px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.fileName}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        {row.categoryName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {row.entityType ? (
                        <span className="block">
                          {entityModuleLabel(row.entityType)}
                          {row.entityId ? (
                            <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">{row.entityId}</span>
                          ) : (
                            <span className="mt-0.5 block text-[11px] text-amber-600 dark:text-amber-400">
                              （未填有效 UUID）
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {formatBytes(row.fileSize)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {formatDateTime(row.createdAt)}
                    </td>
                    {isPersonal && personalTab === "shared" ? (
                      <>
                        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {row.sharedByName ?? "—"}
                          </span>
                          {row.sharedByEmail ? (
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{row.sharedByEmail}</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {sharePermissionLabel(row.sharePermission ?? "")}
                        </td>
                      </>
                    ) : null}
                    {isPersonal ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {personalTab === "mine" ? (
                            <>
                              <a
                                href={`/api/documents/${row.id}/download`}
                                className="text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                              >
                                下載
                              </a>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => openShareDialog(row)}
                              >
                                分享
                              </Button>
                            </>
                          ) : row.sharePermission === "download" ? (
                            <a
                              href={`/api/documents/${row.id}/download`}
                              className="text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                            >
                              下載
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-500">僅檢視</span>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增文件分類</DialogTitle>
            <DialogDescription>建立字典項目後，即可於上傳時指派到此分類。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-cat-name">分類名稱</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="例如：客戶合約"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-cat-desc">說明（選填）</Label>
              <Textarea
                id="new-cat-desc"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="簡短描述此分類用途"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={savingCategory} onClick={() => void submitNewCategory()}>
              {savingCategory ? "儲存中…" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上傳文件</DialogTitle>
            <DialogDescription>
              {isPersonal
                ? "選擇檔案與分類；上傳後將寫入伺服器本機目錄（開發環境），並可下載與分享給其他帳號。"
                : "選擇檔案與分類；關聯業務為選填。實體檔案寫入伺服器本機目錄，亦可後續改接雲端儲存。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="upload-file">選擇檔案</Label>
              <Input
                id="upload-file"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>分類（必填）</Label>
              <Select value={uploadCategoryId || undefined} onValueChange={setUploadCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isPersonal ? (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                關聯業務：已固定為「個人網盤」與您帳號，無需另選模塊。
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label>關聯模塊（選填）</Label>
                  <Select
                    value={uploadEntityModule || "__none__"}
                    onValueChange={(v) => {
                      const next = v === "__none__" ? "" : v;
                      setUploadEntityModule(next);
                      if (!next) setUploadEntityRef("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不關聯" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不關聯</SelectItem>
                      {ENTITY_MODULES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-entity-ref">單據 ID 或名稱（預留）</Label>
                  <Input
                    id="upload-entity-ref"
                    value={uploadEntityRef}
                    onChange={(e) => setUploadEntityRef(e.target.value)}
                    placeholder={uploadEntityModule ? "輸入 UUID 或待串接搜尋" : "請先選模塊"}
                    disabled={!uploadEntityModule}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={uploading} onClick={() => void submitUpload()}>
              {uploading ? "上傳中…" : "確認上傳"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) setShareDoc(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分享檔案</DialogTitle>
            <DialogDescription className="break-all">
              {shareDoc?.fileName ?? ""} — 指定內部同事與權限（僅檢視／可下載）。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto py-2">
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">已分享</p>
              {shareListLoading ? (
                <p className="text-xs text-zinc-500">載入中…</p>
              ) : shareList.length === 0 ? (
                <p className="text-xs text-zinc-500">尚未分享給其他人</p>
              ) : (
                <ul className="space-y-2">
                  {shareList.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-2 text-xs dark:border-zinc-700"
                    >
                      <div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.userName}</span>
                        <span className="block text-zinc-500">{s.userEmail}</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{sharePermissionLabel(s.permission)}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => void revokeShare(s.sharedWithUserId)}
                      >
                        取消
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="mb-2 text-xs font-medium text-zinc-500">新增分享</p>
              <div className="grid gap-2">
                <Label htmlFor="share-user-search">搜尋同事（姓名或信箱）</Label>
                <Input
                  id="share-user-search"
                  value={userSearchQ}
                  onChange={(e) => setUserSearchQ(e.target.value)}
                  placeholder="輸入關鍵字…"
                  autoComplete="off"
                />
                {userSearchLoading ? <p className="text-xs text-zinc-500">搜尋中…</p> : null}
                {pickUser ? (
                  <p className="rounded-md bg-violet-50 px-2 py-1.5 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                    已選：{pickUser.name}（{pickUser.email}）
                  </p>
                ) : null}
                {userSearchHits.length > 0 ? (
                  <ul className="max-h-32 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                    {userSearchHits.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-2 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setPickUser(u);
                            setUserSearchHits([]);
                            setUserSearchQ("");
                          }}
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-zinc-500">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="grid gap-2">
                  <Label>權限</Label>
                  <Select
                    value={sharePermissionPick}
                    onValueChange={(v) => setSharePermissionPick(v as "view" | "download")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="download">可下載</SelectItem>
                      <SelectItem value="view">僅檢視</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setShareDialogOpen(false)}>
              關閉
            </Button>
            <Button type="button" disabled={shareSaving || !pickUser} onClick={() => void submitShare()}>
              {shareSaving ? "儲存中…" : "加入分享"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
