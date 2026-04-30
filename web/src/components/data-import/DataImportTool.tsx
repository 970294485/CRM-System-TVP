"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATA_IMPORT_TYPES, type DataImportType } from "@/lib/validations/data-import";

const IMPORT_LABELS: Record<DataImportType, string> = {
  QUOTATION: "報價單（QUOTATION）",
  PO: "採購單（PO）",
  INVENTORY: "庫存（INVENTORY）",
};

type Props = {
  editable: boolean;
};

export function DataImportTool({ editable }: Props) {
  const [importType, setImportType] = useState<DataImportType>("QUOTATION");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = useCallback((file: File | null) => {
    setParseError(null);
    setRows(null);
    setFileName(null);
    if (!file) return;

    setFileName(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors.length > 0) {
          const msg = result.errors.map((e) => e.message).join("；");
          setParseError(msg);
          return;
        }
        const data = (result.data as Record<string, unknown>[]).filter((row) =>
          Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
        );
        setRows(data);
        toast.success(`已解析 ${data.length} 筆（含表頭欄位：${result.meta.fields?.length ?? 0}）`);
      },
      error: (err) => {
        setParseError(err.message);
      },
    });
  }, []);

  const onSubmit = async () => {
    if (!editable || uploading || !rows || rows.length === 0) {
      if (!rows || rows.length === 0) toast.error("請先選擇有效的 CSV");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/data-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importType, rows }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errors?: { row: number; message: string }[];
        inserted?: number;
        batchId?: string;
        message?: string;
        hint?: string;
      };
      if (!res.ok) {
        if (data.errors?.length) {
          const preview = data.errors
            .slice(0, 5)
            .map((e) => `第 ${e.row} 列：${e.message}`)
            .join("；");
          toast.error(`${data.error || "匯入失敗"}：${preview}${data.errors.length > 5 ? "…" : ""}`);
        } else {
          toast.error([data.error, data.hint].filter(Boolean).join(" ") || `匯入失敗（${res.status}）`);
        }
        return;
      }
      toast.success(data.message || `已寫入 ${data.inserted ?? rows.length} 筆（batch ${data.batchId ?? ""}）`);
      setRows(null);
      setFileName(null);
    } catch {
      toast.error("網路錯誤");
    } finally {
      setUploading(false);
    }
  };

  const previewKeys = rows && rows.length > 0 ? Object.keys(rows[0]!) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV 批量匯入</CardTitle>
        <CardDescription>
          使用 PapaParse 解析 CSV，送至 /api/data-import；目前寫入暫存表，供後續報價／採購／庫存模塊對接。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editable ? (
          <p className="text-sm text-zinc-500">僅管理員可執行匯入。</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>匯入類型</Label>
              <Select value={importType} onValueChange={(v) => setImportType(v as DataImportType)}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_IMPORT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {IMPORT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV 檔案</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm dark:text-zinc-400 dark:file:border-zinc-600 dark:file:bg-zinc-900"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              {fileName ? <p className="text-xs text-zinc-500">已選擇：{fileName}</p> : null}
              {parseError ? <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p> : null}
            </div>
            <Button type="button" onClick={() => void onSubmit()} disabled={uploading || !rows?.length}>
              {uploading ? "上傳中…" : "送出匯入"}
            </Button>
            {rows && rows.length > 0 ? (
              <div className="crm-table-shell max-h-64 overflow-auto rounded border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[480px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                      {previewKeys.map((k) => (
                        <th key={k} className="px-2 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80">
                        {previewKeys.map((k) => (
                          <td key={k} className="max-w-[140px] truncate px-2 py-1.5 text-zinc-800 dark:text-zinc-200">
                            {r[k] != null ? String(r[k]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 8 ? (
                  <p className="border-t border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 dark:border-zinc-700">
                    預覽僅顯示前 8 列，共 {rows.length} 列將一併送出。
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
