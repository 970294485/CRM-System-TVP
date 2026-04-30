"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveCustomerDictionaryItem,
  type CustomerDictionaryKind,
} from "@/actions/customer-master-dictionaries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CustomerDictRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const TAB_META: { id: CustomerDictionaryKind; label: string }[] = [
  { id: "group", label: "分組" },
  { id: "follow_up_status", label: "跟進情況" },
  { id: "lead_source", label: "來源" },
];

type FormState = { ok: true } | { ok: false; message: string } | null;

function DictionaryRowEditor({
  row,
  kind,
}: {
  row: CustomerDictRow;
  kind: CustomerDictionaryKind;
}) {
  const router = useRouter();
  const [delState, delAction] = useActionState(async (_p: FormState, fd: FormData): Promise<FormState> => {
    try {
      await saveCustomerDictionaryItem(fd);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "刪除失敗" };
    }
  }, null);

  const [saveState, saveAction] = useActionState(async (_p: FormState, fd: FormData): Promise<FormState> => {
    try {
      await saveCustomerDictionaryItem(fd);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "儲存失敗" };
    }
  }, null);

  useEffect(() => {
    if (saveState?.ok || delState?.ok) router.refresh();
  }, [saveState, delState, router]);

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <form action={saveAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input type="hidden" name="mode" value="update" />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={row.id} />
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs">
          <span className="text-zinc-500">名稱</span>
          <input
            name="name"
            defaultValue={row.name}
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="text-zinc-500">排序</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={row.sortOrder}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-500">狀態</span>
          <select
            name="isActive"
            defaultValue={row.isActive ? "true" : "false"}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            <option value="true">啟用</option>
            <option value="false">停用</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          儲存
        </button>
      </form>
      {saveState?.ok === false ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{saveState.message}</p>
      ) : null}
      <form action={delAction} className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <input type="hidden" name="mode" value="delete" />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={row.id} />
        <button
          type="submit"
          className="text-xs text-red-600 hover:underline dark:text-red-400"
          onClick={(e) => {
            if (!confirm(`確定刪除「${row.name}」？使用此項目的客戶將改為未指定。`)) e.preventDefault();
          }}
        >
          刪除此項目
        </button>
      </form>
      {delState?.ok === false ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{delState.message}</p>
      ) : null}
    </div>
  );
}

function DictionaryCreateForm({ kind }: { kind: CustomerDictionaryKind }) {
  const router = useRouter();
  const [state, action] = useActionState(async (_p: FormState, fd: FormData): Promise<FormState> => {
    try {
      await saveCustomerDictionaryItem(fd);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "新增失敗" };
    }
  }, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-600">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">新增項目</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input type="hidden" name="mode" value="create" />
        <input type="hidden" name="kind" value={kind} />
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs">
          <span className="text-zinc-500">名稱</span>
          <input
            name="name"
            required
            placeholder="輸入名稱"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="text-zinc-500">排序</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={0}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新增
        </button>
      </div>
      {state?.ok === false ? <p className="text-xs text-red-600 dark:text-red-400">{state.message}</p> : null}
    </form>
  );
}

export function CustomerDictionaryManager({
  groups,
  statuses,
  sources,
  editable,
}: {
  groups: CustomerDictRow[];
  statuses: CustomerDictRow[];
  sources: CustomerDictRow[];
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CustomerDictionaryKind>("group");

  if (!editable) return null;

  const rows =
    tab === "group" ? groups : tab === "follow_up_status" ? statuses : sources;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
      >
        分組／跟進／來源管理
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>主資料管理</DialogTitle>
            <DialogDescription>
              維護客戶表單中的分組、跟進情況與來源選項。停用後仍會顯示於已選客戶，但標示為停用；刪除後關聯客戶該欄將清空。
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            {TAB_META.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "flex-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium shadow-sm dark:bg-zinc-950"
                    : "flex-1 rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500">尚無項目，請使用下方新增。</p>
            ) : (
              rows.map((r) => (
                <DictionaryRowEditor
                  key={`${r.id}-${r.name}-${r.sortOrder}-${r.isActive}`}
                  row={r}
                  kind={tab}
                />
              ))
            )}
          </div>

          <DictionaryCreateForm
            key={`create-${tab}-${rows.map((r) => r.id).join(",")}`}
            kind={tab}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
