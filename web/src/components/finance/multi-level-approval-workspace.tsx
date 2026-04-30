"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RoleOption = { id: string; slug: string; name: string };

type PolicyItem = {
  id: string;
  name: string;
  documentType: string;
  amountMin: string;
  isActive: boolean;
  steps: { label: string; roleSlugs: string[] }[];
  sortOrder: number;
};

function fmtMoneyCap(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function MultiLevelApprovalWorkspace({ editable }: { editable: boolean }) {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [formName, setFormName] = useState("");
  const [formAmountMin, setFormAmountMin] = useState("0");
  const [formActive, setFormActive] = useState(true);
  const [formSteps, setFormSteps] = useState<{ label: string; slugPicks: Set<string> }[]>([
    { label: "初審", slugPicks: new Set() },
  ]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/finance/approval-policies", { credentials: "same-origin" }),
        editable
          ? fetch("/api/finance/approval-roles", { credentials: "same-origin" })
          : Promise.resolve(null as Response | null),
      ]);
      const pJson = (await pRes.json().catch(() => ({}))) as {
        items?: PolicyItem[];
        warning?: string;
        error?: string;
      };
      if (!pRes.ok) throw new Error(pJson.error ?? "讀取策略失敗");
      if (pJson.warning) toast.warning(pJson.warning);
      setPolicies(pJson.items ?? []);

      if (rRes && editable) {
        const rJson = (await rRes.json().catch(() => ({}))) as { items?: RoleOption[]; error?: string };
        if (!rRes.ok) {
          toast.error(rJson.error ?? "無法載入角色清單");
        } else {
          setRoles(rJson.items ?? []);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [editable]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function toggleSlug(stepIdx: number, slug: string) {
    setFormSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIdx) return s;
        const next = new Set(s.slugPicks);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return { ...s, slugPicks: next };
      })
    );
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const name = formName.trim();
    if (!name) {
      toast.error("請輸入策略名稱");
      return;
    }
    const amt = Number(formAmountMin.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("請輸入有效的金額門檻（≥ 0）");
      return;
    }
    if (formActive) {
      for (let i = 0; i < formSteps.length; i++) {
        const s = formSteps[i]!;
        if (!s.label.trim()) {
          toast.error(`第 ${i + 1} 階標籤不可為空`);
          return;
        }
        if (s.slugPicks.size === 0) {
          toast.error(`第 ${i + 1} 階請至少選一個角色`);
          return;
        }
      }
    }
    const stepsPayload = formActive
      ? formSteps.map((s) => ({ label: s.label.trim(), roleSlugs: [...s.slugPicks] }))
      : [];

    setSaving(true);
    try {
      const res = await fetch("/api/finance/approval-policies", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          documentType: "AP_PAYMENT",
          amountMin: amt,
          isActive: formActive,
          sortOrder: 0,
          steps: stepsPayload,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "建立失敗");
        return;
      }
      toast.success("已新增策略");
      setFormName("");
      setFormAmountMin("0");
      setFormActive(true);
      setFormSteps([{ label: "初審", slugPicks: new Set() }]);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removePolicy(id: string) {
    if (!editable) return;
    if (!window.confirm("確定刪除此策略？")) return;
    const res = await fetch(`/api/finance/approval-policies/${id}`, { method: "DELETE", credentials: "same-origin" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "刪除失敗");
      return;
    }
    toast.success("已刪除");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">運作說明</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>可依「請款金額」門檻（amount_min）重疊多條規則，系統採<strong>不超過請款金額的最大門檻</strong>那條策略。</li>
          <li>
            每階對應模組 9 的<strong>角色 slug</strong>；具該任一角色者可簽該階。<code className="text-[11px]">super_admin</code>{" "}
            可強制確認付款並可簽任一步驟。
          </li>
          <li>
            「管理請款單」中草稿將顯示審批進度；未完成前無法確認付款。
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">載入中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2 font-medium">名稱</th>
                <th className="px-3 py-2 font-medium">單據類型</th>
                <th className="px-3 py-2 font-medium text-right">金額門檻 ≥</th>
                <th className="px-3 py-2 font-medium">啟用</th>
                <th className="px-3 py-2 font-medium">審批鏈</th>
                {editable ? <th className="px-3 py-2 font-medium text-right">操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 6 : 5} className="px-3 py-8 text-center text-zinc-500">
                    尚無策略；新增一條以套用應付請款多階核准。
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{p.documentType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyCap(p.amountMin)}</td>
                    <td className="px-3 py-2">{p.isActive ? "是" : "否"}</td>
                    <td className="max-w-[360px] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {p.steps.length === 0
                        ? "—"
                        : p.steps.map((s, i) => (
                            <span key={i} className="mr-2 inline-block rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                              {i + 1}.{s.label} ({s.roleSlugs.join("|")})
                            </span>
                          ))}
                    </td>
                    {editable ? (
                      <td className="px-3 py-2 text-right">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void removePolicy(p.id)}>
                          刪除
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editable ? (
        <form className="space-y-4 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-600" onSubmit={submitCreate}>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">新增策略</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pol-name">名稱</Label>
              <Input id="pol-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例：應付大額三階審批" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-amt">請款金額門檻（≥）</Label>
              <Input
                id="pol-amt"
                inputMode="decimal"
                value={formAmountMin}
                onChange={(e) => setFormAmountMin(e.target.value)}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
            啟用
          </label>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">審批階段（由上而下順序）</p>
            {formSteps.map((s, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700 sm:flex-row sm:items-start">
                <div className="flex-1 space-y-1">
                  <Label>第 {idx + 1} 階標籤</Label>
                  <Input
                    value={s.label}
                    onChange={(e) =>
                      setFormSteps((prev) => prev.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="flex-[2] space-y-1">
                  <Label>可簽角色</Label>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r) => (
                      <label key={r.slug} className="flex cursor-pointer items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">
                        <input
                          type="checkbox"
                          checked={s.slugPicks.has(r.slug)}
                          onChange={() => toggleSlug(idx, r.slug)}
                        />
                        <span title={r.id}>
                          {r.name} ({r.slug})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={formSteps.length <= 1}
                    onClick={() => setFormSteps((prev) => prev.filter((_, j) => j !== idx))}
                  >
                    移除此階
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFormSteps((prev) => [...prev, { label: "", slugPicks: new Set() }])}
          >
            再加一階
          </Button>

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "儲存中…" : "建立策略"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-400">您無財務編輯權限，無法在此新增／刪除策略。</p>
      )}
    </div>
  );
}
