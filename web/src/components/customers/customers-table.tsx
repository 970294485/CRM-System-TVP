"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { saveCustomer } from "@/actions/customers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  CustomerDictionaryManager,
  type CustomerDictRow,
} from "./customer-dictionary-manager";
import {
  CustomerForm,
  type CustomerFormDTO,
  type DictOption,
  type OrgOption,
  type UserOption,
} from "./customer-form";

export type CustomerTableRow = CustomerFormDTO & {
  leadSourceName: string | null;
  followUpName: string | null;
  groupName: string | null;
  updatedAt: string | null;
};

const LIFECYCLE_LABEL: Record<string, string> = {
  potential: "潛在",
  negotiating: "洽談中",
  active: "成交／活躍",
  dormant: "沉寂",
  churned: "流失",
};

type DeleteState = { ok: true } | { ok: false; message: string } | null;

function isNextRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function CustomersTable({
  rows,
  sources,
  groups,
  statuses,
  dictionaryGroups,
  dictionaryStatuses,
  dictionarySources,
  orgs,
  users,
  editable,
  hasActiveSearch = false,
}: {
  rows: CustomerTableRow[];
  sources: DictOption[];
  groups: DictOption[];
  statuses: DictOption[];
  dictionaryGroups: CustomerDictRow[];
  dictionaryStatuses: CustomerDictRow[];
  dictionarySources: CustomerDictRow[];
  orgs: OrgOption[];
  users: UserOption[];
  editable: boolean;
  /** 已送出搜尋條件但無列時，顯示「沒有符合」而非「尚無客戶」 */
  hasActiveSearch?: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<CustomerTableRow | null>(null);
  const [editRow, setEditRow] = useState<CustomerTableRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CustomerTableRow | null>(null);

  const [deleteState, deleteAction] = useActionState(async (_prev: DeleteState, formData: FormData): Promise<DeleteState> => {
    try {
      await saveCustomer(formData);
      return { ok: true };
    } catch (e) {
      if (isNextRedirectError(e)) throw e;
      return { ok: false, message: e instanceof Error ? e.message : "刪除失敗" };
    }
  }, null);

  useEffect(() => {
    if (deleteState?.ok) {
      setDeleteRow(null);
      router.refresh();
    }
  }, [deleteState, router]);

  const refreshAndCloseEditors = () => {
    setCreateOpen(false);
    setEditRow(null);
    router.refresh();
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">客戶列表</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            搜尋名稱、聯絡人、電話或 Email。點表格列可快速「查看」；亦可用右側按鈕開啟彈窗完成查閱、新增、編輯與刪除
            {editable ? "" : "（目前帳號僅可查看；增刪改需業務／管理員權限）"}。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomerDictionaryManager
            groups={dictionaryGroups}
            statuses={dictionaryStatuses}
            sources={dictionarySources}
            editable={editable}
          />
          {editable ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              新增客戶
            </button>
          ) : null}
        </div>
      </div>

      <div className="crm-table-shell">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <th className="px-4 py-3 font-medium">客戶</th>
              <th className="px-4 py-3 font-medium">聯絡人</th>
              <th className="px-4 py-3 font-medium">電話</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">生命週期</th>
              <th className="px-4 py-3 font-medium">分組</th>
              <th className="px-4 py-3 font-medium">來源</th>
              <th className="px-4 py-3 font-medium">跟進</th>
              <th className="px-4 py-3 font-medium text-right">更新</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                  {hasActiveSearch ? "沒有符合的客戶。" : "尚無客戶，請使用「新增客戶」建立。"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  onClick={() => setViewRow(r)}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{r.name}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.contactName ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{r.phone ?? "—"}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">{LIFECYCLE_LABEL[r.lifecycle] ?? r.lifecycle}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.groupName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.leadSourceName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.followUpName ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-500">
                    {r.updatedAt
                      ? new Date(r.updatedAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex flex-wrap justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setViewRow(r)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        查看
                      </button>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setEditRow(r)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          編輯
                        </button>
                      ) : null}
                      <Link
                        href={`/dashboard/customers/${r.id}`}
                        className={cn(
                          "inline-flex rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        )}
                      >
                        跟進
                      </Link>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setDeleteRow(r)}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          刪除
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增客戶</DialogTitle>
            <DialogDescription>建立後可於列表或跟進頁繼續維護。</DialogDescription>
          </DialogHeader>
          <CustomerForm
            key="new"
            customer={null}
            editable={editable}
            sources={sources}
            groups={groups}
            statuses={statuses}
            orgs={orgs}
            users={users}
            variant="modal"
            onModalSaved={refreshAndCloseEditors}
            onModalCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>客戶資料</DialogTitle>
            <DialogDescription>唯讀檢視</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <CustomerForm
              key={viewRow.id}
              customer={rowToDto(viewRow)}
              editable={false}
              viewMode
              sources={sources}
              groups={groups}
              statuses={statuses}
              orgs={orgs}
              users={users}
              variant="modal"
            />
          ) : null}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setViewRow(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              關閉
            </button>
            {editable && viewRow ? (
              <button
                type="button"
                onClick={() => {
                  const row = viewRow;
                  setEditRow(row);
                  setViewRow(null);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                改為編輯
              </button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯客戶</DialogTitle>
            <DialogDescription>儲存後列表將自動更新。</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <CustomerForm
              key={editRow.id}
              customer={rowToDto(editRow)}
              editable={editable}
              sources={sources}
              groups={groups}
              statuses={statuses}
              orgs={orgs}
              users={users}
              variant="modal"
              onModalSaved={refreshAndCloseEditors}
              onModalCancel={() => setEditRow(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>刪除客戶</DialogTitle>
            <DialogDescription>
              {deleteRow ? `確定刪除「${deleteRow.name}」？跟進紀錄將一併刪除，且無法復原。` : null}
            </DialogDescription>
          </DialogHeader>
          {deleteState?.ok === false ? (
            <p className="text-sm text-red-600 dark:text-red-400">{deleteState.message}</p>
          ) : null}
          <form action={deleteAction} className="space-y-4">
            <input type="hidden" name="navigation" value="list" />
            <input type="hidden" name="mode" value="delete" />
            <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                取消
              </button>
              <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
                確認刪除
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function rowToDto(r: CustomerTableRow): CustomerFormDTO {
  return {
    id: r.id,
    name: r.name,
    contactName: r.contactName,
    phone: r.phone,
    email: r.email,
    address: r.address,
    organizationId: r.organizationId,
    leadSourceId: r.leadSourceId,
    customerGroupId: r.customerGroupId,
    followUpStatusId: r.followUpStatusId,
    lifecycle: r.lifecycle,
    tags: r.tags,
    valueTier: r.valueTier,
    assignedToUserId: r.assignedToUserId,
    notes: r.notes,
  };
}
