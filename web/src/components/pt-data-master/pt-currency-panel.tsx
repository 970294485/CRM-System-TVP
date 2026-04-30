"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { savePtCurrency } from "@/actions/pt-data-master";

export type PtCurrencyDTO = {
  id: string;
  isoCode: string;
  label: string | null;
  quoteTwdPerUnit: string | null;
  sortOrder: number;
  isActive: boolean;
};

function ModalBackdrop({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" aria-label="關閉" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function CurrencyFields({ defaults }: { defaults?: PtCurrencyDTO }) {
  return (
    <>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">ISO 碼（例 USD）</label>
        <input
          name="isoCode"
          required
          defaultValue={defaults?.isoCode ?? ""}
          readOnly={!!defaults}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono uppercase dark:border-zinc-600 dark:bg-zinc-950 read-only:bg-zinc-50 dark:read-only:bg-zinc-900"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">顯示名稱</label>
        <input
          name="label"
          defaultValue={defaults?.label ?? ""}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">每 1 單位外幣兌台幣</label>
        <input
          name="quoteTwdPerUnit"
          placeholder="清空表示未設定"
          defaultValue={defaults?.quoteTwdPerUnit ?? ""}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <p className="mt-1 text-xs text-zinc-500">例：1 USD = 32.5 新台幣，填 32.5</p>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">排序</label>
        <input
          type="number"
          name="sortOrder"
          min={0}
          defaultValue={defaults?.sortOrder ?? 10}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
      </div>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={defaults?.isActive ?? true} className="h-4 w-4 rounded border-zinc-300" />
        啟用
      </label>
    </>
  );
}

export function PtCurrencyPanel({ rows, editable }: { rows: PtCurrencyDTO[]; editable: boolean }) {
  const router = useRouter();
  const [modal, setModal] = useState<null | { mode: "create" | "edit" | "delete"; row?: PtCurrencyDTO }>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        新台幣為隱含基準；快照匯率，不含歷史版本。請配合財會流程定期更新。</p>

      {editable ? (
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新增幣別
        </button>
      ) : null}

      <div className="rounded-lg border border-zinc-200 overflow-x-auto dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2 font-medium">代號</th>
              <th className="px-3 py-2 font-medium">名稱</th>
              <th className="px-3 py-2 font-medium">對 TWD</th>
              <th className="px-3 py-2 font-medium">狀態</th>
              {editable ? <th className="px-3 py-2 font-medium">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 font-mono">{r.isoCode}</td>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2">{r.quoteTwdPerUnit ?? "—"}</td>
                <td className="px-3 py-2">{r.isActive ? "啟用" : "停用"}</td>
                {editable ? (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button type="button" className="text-blue-700 dark:text-blue-400" onClick={() => setModal({ mode: "edit", row: r })}>
                      編輯
                    </button>
                    <span className="mx-1 text-zinc-300 dark:text-zinc-600">|</span>
                    <button type="button" className="text-red-700 dark:text-red-400" onClick={() => setModal({ mode: "delete", row: r })}>
                      刪除
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.mode === "create" ? (
        <ModalBackdrop title="新增幣別" onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              fd.set(
                "isoCode",
                (fd.get("isoCode")?.toString() ?? "").trim().toUpperCase(),
              );
              await savePtCurrency(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <CurrencyFields />
            <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              建立
            </button>
          </form>
        </ModalBackdrop>
      ) : null}

      {modal?.mode === "edit" && modal.row ? (
        <ModalBackdrop title={`編輯 ${modal.row.isoCode}`} onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              fd.set("mode", "update");
              fd.append("id", modal.row!.id);
              await savePtCurrency(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <CurrencyFields defaults={modal.row} />
            <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              儲存
            </button>
          </form>
        </ModalBackdrop>
      ) : null}

      {modal?.mode === "delete" && modal.row ? (
        <ModalBackdrop title="刪除幣別" onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              fd.set("mode", "delete");
              fd.append("id", modal.row!.id);
              await savePtCurrency(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <p className="text-sm">確定刪除「{modal.row.isoCode}」？</p>
            <button type="submit" className="w-full rounded-md bg-red-600 py-2 text-sm font-medium text-white">
              刪除
            </button>
          </form>
        </ModalBackdrop>
      ) : null}
    </section>
  );
}
