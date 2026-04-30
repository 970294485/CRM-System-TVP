"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProductListItem } from "@/lib/product-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ProductEntryForm } from "./product-entry-form";

function formatPrice(value: string | null): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
}

type Props = {
  initialProducts: ProductListItem[];
  editable: boolean;
};

export function ProductEntryPanel({ initialProducts, editable }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const onSaved = () => {
    setOpen(false);
    setFormKey((k) => k + 1);
    router.refresh();
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          共 {initialProducts.length} 筆；具銷售編輯權限者可新增產品。
        </p>
        {editable ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">新增產品</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(92vh,56rem)] w-[min(100vw-1.5rem,42rem)] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>新增產品</DialogTitle>
              </DialogHeader>
              <ProductEntryForm key={formKey} disabled={false} embedded onSuccess={onSaved} />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="crm-table-shell">
        {initialProducts.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {editable ? "尚無產品資料。點「新增產品」開始建立。" : "尚無產品資料。"}
          </p>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                <th className="px-3 py-3">圖</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">名稱</th>
                <th className="px-3 py-3">分類</th>
                <th className="px-3 py-3 text-right">基礎售價</th>
                <th className="px-3 py-3">狀態</th>
                <th className="px-3 py-3">描述摘要</th>
                <th className="px-3 py-3 whitespace-nowrap">建立時間</th>
              </tr>
            </thead>
            <tbody>
              {initialProducts.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                      {p.thumbUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-zinc-400">{p.imageCount > 0 ? p.imageCount : "—"}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">{p.sku}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{p.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                    {formatPrice(p.basePrice)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        p.isActive
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                      }
                    >
                      {p.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400" title={p.descriptionPreview}>
                    {p.descriptionPreview || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(p.createdAtIso)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
