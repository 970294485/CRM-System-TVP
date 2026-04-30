"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DescriptionEditor } from "./description-editor";
import { emptyKeyValueRows, KeyValueRows, rowsToRecord, type KeyValueRow } from "./key-value-rows";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif";

type Props = {
  disabled?: boolean;
  /** 置於彈窗內：不顯示外層 Card，區塊較緊湊 */
  embedded?: boolean;
  /** 儲存成功後（已 toast）；彈窗頁面可用來關閉與 refresh */
  onSuccess?: () => void;
};

type StagedImage = { id: string; file: File; url: string };

export function ProductEntryForm({ disabled, embedded, onSuccess }: Props) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [attrRows, setAttrRows] = useState<KeyValueRow[]>(() => emptyKeyValueRows());
  const [specRows, setSpecRows] = useState<KeyValueRow[]>(() => emptyKeyValueRows());
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokeStaged = useCallback((items: StagedImage[]) => {
    for (const s of items) URL.revokeObjectURL(s.url);
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) return;
      setStaged((prev) => {
        const next = [...prev];
        const cap = 12 - next.length;
        const take = arr.slice(0, Math.max(0, cap));
        if (take.length < arr.length) toast.message(`最多 12 張圖，已略過 ${arr.length - take.length} 張`);
        for (const file of take) {
          next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
        }
        return next;
      });
    },
    []
  );

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((s) => s.id !== id);
    });
  };

  const resetForm = () => {
    revokeStaged(staged);
    setSku("");
    setName("");
    setCategory("");
    setBasePrice("");
    setDescriptionHtml("");
    setEditorResetKey((k) => k + 1);
    setIsActive(true);
    setAttrRows(emptyKeyValueRows());
    setSpecRows(emptyKeyValueRows());
    setStaged([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("sku", sku);
      fd.append("name", name);
      fd.append("category", category);
      fd.append("base_price", basePrice);
      fd.append("description", descriptionHtml);
      fd.append("attributes", JSON.stringify(rowsToRecord(attrRows)));
      fd.append("specifications", JSON.stringify(rowsToRecord(specRows)));
      fd.append("is_active", isActive ? "true" : "false");
      for (const s of staged) {
        fd.append("images", s.file);
      }

      const res = await fetch("/api/products", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok) {
        toast.error(data.error || `儲存失敗（${res.status}）`);
        return;
      }

      toast.success("產品已儲存");
      resetForm();
      onSuccess?.();
    } catch {
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form onSubmit={onSubmit} className={embedded ? "space-y-6" : "space-y-8"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="sku">SKU（產品編號） *</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={disabled}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="name">產品名稱 *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} required />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="category">產品分類</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="base_price">基礎售價</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                disabled={disabled}
                placeholder="例如 1999.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>產品描述（富文本）</Label>
            <DescriptionEditor
              key={editorResetKey}
              initialHtml={descriptionHtml}
              onChange={setDescriptionHtml}
              disabled={disabled}
            />
          </div>

          <div
            className={`space-y-2 rounded-lg border-2 border-dashed p-4 transition-colors ${
              dragOver ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : "border-zinc-300 dark:border-zinc-600"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-base">圖片上傳</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || staged.length >= 12}
                onClick={() => fileInputRef.current?.click()}
              >
                選擇檔案
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_IMAGES}
                multiple
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">拖曳圖片到此，或點選選擇；最多 12 張，單檔 5MB 以內。</p>
            {staged.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-3">
                {staged.map((s) => (
                  <li key={s.id} className="relative h-20 w-20 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white hover:bg-black/80"
                      onClick={() => removeStaged(s.id)}
                      disabled={disabled}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <KeyValueRows
            title="產品屬性 (Attributes)"
            rows={attrRows}
            onChange={setAttrRows}
            disabled={disabled}
            keyPlaceholder="例如 brand"
            valuePlaceholder="例如 Apple"
          />

          <KeyValueRows
            title="技術規格 (Specifications)"
            rows={specRows}
            onChange={setSpecRows}
            disabled={disabled}
            keyPlaceholder="例如 voltage"
            valuePlaceholder="例如 220V"
          />

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="is_active" className="font-normal">
              啟用（is_active）
            </Label>
          </div>

          <Button type="submit" disabled={disabled || saving}>
            {saving ? "儲存中…" : "儲存"}
          </Button>
    </form>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          填寫基本資料、圖片、描述與屬性；儲存成功後將關閉視窗並更新列表。
        </p>
        {form}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>產品與服務</CardTitle>
        <CardDescription>填寫基本資料、圖片、描述與屬性後儲存至資料庫。</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
