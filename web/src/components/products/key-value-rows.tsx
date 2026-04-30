"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type KeyValueRow = { id: string; key: string; value: string };

type Props = {
  title: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  disabled?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

export function KeyValueRows({
  title,
  rows,
  onChange,
  disabled,
  keyPlaceholder = "屬性名稱",
  valuePlaceholder = "值",
}: Props) {
  const addRow = () => {
    onChange([...rows, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  const patch = (id: string, field: "key" | "value", value: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base">{title}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          新增一列
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={keyPlaceholder}
              value={r.key}
              onChange={(e) => patch(r.id, "key", e.target.value)}
              disabled={disabled}
              className="min-w-[120px] flex-1"
            />
            <Input
              placeholder={valuePlaceholder}
              value={r.value}
              onChange={(e) => patch(r.id, "value", e.target.value)}
              disabled={disabled}
              className="min-w-[120px] flex-[2]"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(r.id)} disabled={disabled}>
              刪除
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function rowsToRecord(rows: KeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value;
  }
  return out;
}

export function emptyKeyValueRows(): KeyValueRow[] {
  return [{ id: crypto.randomUUID(), key: "", value: "" }];
}
