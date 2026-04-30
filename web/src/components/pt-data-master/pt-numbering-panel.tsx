"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import {
  allocateNextDocumentNumber,
  createNumberSequence,
  deleteNumberSequence,
  previewNextDocumentLabel,
  saveNumberSequence,
} from "@/actions/pt-data-master";

export type NumberSequenceDTO = {
  id: string;
  entityType: string;
  prefix: string;
  suffix: string;
  padLength: number;
  nextNumber: number;
  resetPolicy: "never" | "yearly";
  dateSegment: "omit" | "year" | "year_month";
};

const DATE_SEGMENT_LABEL: Record<NumberSequenceDTO["dateSegment"], string> = {
  omit: "不插入",
  year: "西元年",
  year_month: "年月 yyyyMM",
};

function ModalBackdrop({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" aria-label="關閉" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
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

function SeqFormFields({
  defaults,
  lockedEntityType,
}: {
  defaults?: NumberSequenceDTO;
  lockedEntityType?: boolean;
}) {
  return (
    <>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">類型鍵 *</label>
        <input
          name="entityType"
          required
          defaultValue={defaults?.entityType ?? ""}
          readOnly={lockedEntityType}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 read-only:bg-zinc-50 dark:read-only:bg-zinc-900"
          placeholder="quotation"
        />
        <p className="mt-1 text-xs text-zinc-500">小寫英數與底線，例：quotation、invoice</p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">前綴</label>
          <input
            name="prefix"
            defaultValue={defaults?.prefix ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="QT-"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">後綴</label>
          <input name="suffix" defaultValue={defaults?.suffix ?? ""} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">日期段</label>
        <select
          name="dateSegment"
          defaultValue={defaults?.dateSegment ?? "omit"}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        >
          <option value="omit">不插入（僅前綴 + 流水）</option>
          <option value="year">西元年度（香港時區）</option>
          <option value="year_month">年月 yyyyMM（香港時區）</option>
        </select>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">流水位數</label>
          <input
            name="padLength"
            type="number"
            min={1}
            max={12}
            defaultValue={defaults?.padLength ?? 6}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">下一個序號</label>
          <input
            name="nextNumber"
            type="number"
            min={1}
            defaultValue={defaults?.nextNumber ?? 1}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">重置策略</label>
        <select
          name="resetPolicy"
          defaultValue={defaults?.resetPolicy ?? "never"}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        >
          <option value="never">不重設</option>
          <option value="yearly">逐年（香港換年）</option>
        </select>
      </div>
    </>
  );
}

export function PtNumberingPanel({ rows, editable }: { rows: NumberSequenceDTO[]; editable: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [modal, setModal] = useState<null | { mode: "create" | "edit" | "delete"; row?: NumberSequenceDTO }>(null);
  const [testEntity, setTestEntity] = useState(rows[0]?.entityType ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [allocMsg, setAllocMsg] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        自定義報價、採購、合同等單據前綴與香港時區年月段；發號請由業務動作或由 API{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">allocateNextDocumentNumber</code>
        ，若僅試算請用下列預覽。
      </p>

      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            新增類型鍵
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2 font-medium">類型鍵</th>
              <th className="px-3 py-2 font-medium">日期段</th>
              <th className="px-3 py-2 font-medium">前／後綴</th>
              <th className="px-3 py-2 font-medium">下一號</th>
              <th className="px-3 py-2 font-medium">重置</th>
              {editable ? <th className="px-3 py-2 font-medium">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">{r.entityType}</td>
                <td className="px-3 py-2">{DATE_SEGMENT_LABEL[r.dateSegment]}</td>
                <td className="px-3 py-2">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {r.prefix}
                    …
                    {r.suffix}
                  </span>
                </td>
                <td className="px-3 py-2">{r.nextNumber}</td>
                <td className="px-3 py-2">{r.resetPolicy === "yearly" ? "逐年" : "否"}</td>
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

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4 dark:border-zinc-600 dark:bg-zinc-900/40">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">試算／取號（開發）</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">類型鍵</label>
            <select
              value={testEntity}
              onChange={(e) => setTestEntity(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              {rows.length === 0 ? <option value="">—</option> : null}
              {rows.map((r) => (
                <option key={r.id} value={r.entityType}>
                  {r.entityType}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!testEntity || isPending}
            onClick={() => {
              setAllocMsg(null);
              setPreview(null);
              start(async () => {
                const p = await previewNextDocumentLabel(testEntity);
                setPreview(p);
              });
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            預覽下一張（不進位）
          </button>
          {editable ? (
            <button
              type="button"
              disabled={!testEntity || isPending}
              onClick={() => {
                if (!window.confirm("將實際消費並進位流水，確定？")) return;
                setPreview(null);
                setAllocMsg(null);
                start(async () => {
                  try {
                    const r = await allocateNextDocumentNumber(testEntity);
                    setAllocMsg(r.code);
                    refresh();
                  } catch (e) {
                    setAllocMsg(e instanceof Error ? e.message : "取號失敗");
                  }
                });
              }}
              className="rounded-md bg-red-900 px-3 py-2 text-sm font-medium text-white dark:bg-red-800"
            >
              實際取號並進位
            </button>
          ) : null}
        </div>
        {preview ? <p className="mt-3 text-sm">預覽：<span className="font-mono font-medium">{preview}</span></p> : null}
        {allocMsg ? <p className="mt-3 text-sm">結果：<span className="font-mono font-medium">{allocMsg}</span></p> : null}
      </div>

      {modal?.mode === "create" ? (
        <ModalBackdrop title="新增單號規則" onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              await createNumberSequence(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <SeqFormFields />
            <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              建立
            </button>
          </form>
        </ModalBackdrop>
      ) : null}

      {modal?.mode === "edit" && modal.row ? (
        <ModalBackdrop title={`編輯 ${modal.row.entityType}`} onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              fd.append("entityType", modal.row!.entityType);
              await saveNumberSequence(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <SeqFormFields defaults={modal.row} lockedEntityType />
            <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              儲存
            </button>
          </form>
        </ModalBackdrop>
      ) : null}

      {modal?.mode === "delete" && modal.row ? (
        <ModalBackdrop title="刪除規則" onClose={() => setModal(null)}>
          <form
            action={async (fd) => {
              fd.append("id", modal.row!.id);
              await deleteNumberSequence(fd);
              setModal(null);
              refresh();
            }}
            className="space-y-4"
          >
            <p className="text-sm">確定刪除「{modal.row.entityType}」？</p>
            <button type="submit" className="w-full rounded-md bg-red-600 py-2 text-sm font-medium text-white">
              刪除
            </button>
          </form>
        </ModalBackdrop>
      ) : null}
    </section>
  );
}
