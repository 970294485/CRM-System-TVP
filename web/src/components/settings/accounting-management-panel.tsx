"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";

import { saveAccountingCategory, saveAccountingItem } from "@/actions/admin";

const TYPE_LABEL: Record<string, string> = {
  Asset: "資產",
  Liability: "負債",
  Equity: "權益",
  Revenue: "收入",
  Expense: "支出",
};

export type AccountingCategoryDTO = {
  id: string;
  code: string;
  name: string;
  type: string;
  sortOrder: number;
  createdAt: string;
  itemCount: number;
};

export type AccountingItemDTO = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

type CatModal =
  | null
  | { mode: "create" }
  | { mode: "view"; row: AccountingCategoryDTO }
  | { mode: "edit"; row: AccountingCategoryDTO }
  | { mode: "delete"; row: AccountingCategoryDTO };

type ItemModal =
  | null
  | { mode: "create" }
  | { mode: "view"; row: AccountingItemDTO }
  | { mode: "edit"; row: AccountingItemDTO }
  | { mode: "delete"; row: AccountingItemDTO };

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

function TypeSelect({
  name,
  defaultValue,
  required,
  disabled,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      name={name}
      required={required}
      disabled={disabled}
      defaultValue={defaultValue}
      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
    >
      <option value="Asset">資產</option>
      <option value="Liability">負債</option>
      <option value="Equity">權益</option>
      <option value="Revenue">收入</option>
      <option value="Expense">支出</option>
    </select>
  );
}

export function AccountingManagementPanel({
  editable,
  categories,
  items,
}: {
  editable: boolean;
  categories: AccountingCategoryDTO[];
  items: AccountingItemDTO[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [catModal, setCatModal] = useState<CatModal>(null);
  const [itemModal, setItemModal] = useState<ItemModal>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">入賬類別</h2>
            <p className="mt-1 text-sm text-zinc-500">會計五大類型下之母類別；刪除類別將一併刪除其下項目。</p>
          </div>
          {editable ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setCatModal({ mode: "create" })}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              新增類別
            </button>
          ) : null}
        </div>

        <div className="crm-table-shell">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-950">
                <th className="whitespace-nowrap px-4 py-3 font-medium">代碼</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">類別名稱</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">類型</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-right">排序</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-right">項目數</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    尚無類別，請新增。
                  </td>
                </tr>
              ) : (
                categories.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3 font-mono text-zinc-800 dark:text-zinc-200">{row.code}</td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[row.type] ?? row.type}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.sortOrder}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.itemCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                          onClick={() => setCatModal({ mode: "view", row })}
                        >
                          查看
                        </button>
                        {editable ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
                              onClick={() => setCatModal({ mode: "edit", row })}
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-400"
                              onClick={() => setCatModal({ mode: "delete", row })}
                            >
                              刪除
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">入賬項目</h2>
            <p className="mt-1 text-sm text-zinc-500">依類別維護細項代碼與名稱。</p>
          </div>
          {editable ? (
            <button
              type="button"
              disabled={isPending || categories.length === 0}
              onClick={() => setItemModal({ mode: "create" })}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              新增項目
            </button>
          ) : null}
        </div>

        <div className="crm-table-shell">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-950">
                <th className="whitespace-nowrap px-4 py-3 font-medium">所屬類別</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">項目代碼</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">項目名稱</th>
                <th className="min-w-[12rem] px-4 py-3 font-medium">說明</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">啟用</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-right">排序</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    {categories.length === 0 ? "請先新增入賬類別。" : "尚無項目。"}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.categoryLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="max-w-md break-words px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.description ?? "—"}</td>
                    <td className="px-4 py-3">{row.isActive ? "是" : "否"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.sortOrder}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                          onClick={() => setItemModal({ mode: "view", row })}
                        >
                          查看
                        </button>
                        {editable ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
                              onClick={() => setItemModal({ mode: "edit", row })}
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-400"
                              onClick={() => setItemModal({ mode: "delete", row })}
                            >
                              刪除
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!editable ? <p className="text-sm text-zinc-500">僅管理員可編輯類別與項目。</p> : null}

      {/* 類別彈窗 */}
      {catModal?.mode === "create" ? (
        <CategoryFormModal
          title="新增入賬類別"
          mode="create"
          defaults={null}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}
      {catModal?.mode === "view" ? (
        <ModalBackdrop title="類別詳情" onClose={() => setCatModal(null)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">代碼</dt>
              <dd className="font-mono">{catModal.row.code}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">類別名稱</dt>
              <dd>{catModal.row.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">類型</dt>
              <dd>{TYPE_LABEL[catModal.row.type] ?? catModal.row.type}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">排序</dt>
              <dd>{catModal.row.sortOrder}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">項目數</dt>
              <dd>{catModal.row.itemCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">建立時間</dt>
              <dd>{catModal.row.createdAt ? new Date(catModal.row.createdAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setCatModal(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              關閉
            </button>
          </div>
        </ModalBackdrop>
      ) : null}
      {catModal?.mode === "edit" ? (
        <CategoryFormModal
          title={`編輯類別 — ${catModal.row.name}`}
          mode="update"
          defaults={catModal.row}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}
      {catModal?.mode === "delete" ? (
        <CategoryDeleteModal
          row={catModal.row}
          onClose={() => setCatModal(null)}
          onDeleted={() => {
            setCatModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}

      {/* 項目彈窗 */}
      {itemModal?.mode === "create" ? (
        <ItemFormModal
          title="新增入賬項目"
          mode="create"
          categories={categories}
          defaults={null}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}
      {itemModal?.mode === "view" ? (
        <ModalBackdrop title="項目詳情" onClose={() => setItemModal(null)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">所屬類別</dt>
              <dd>{itemModal.row.categoryLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">項目代碼</dt>
              <dd className="font-mono">{itemModal.row.code}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">項目名稱</dt>
              <dd>{itemModal.row.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">說明</dt>
              <dd className="whitespace-pre-wrap">{itemModal.row.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">啟用</dt>
              <dd>{itemModal.row.isActive ? "是" : "否"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">排序</dt>
              <dd>{itemModal.row.sortOrder}</dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setItemModal(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              關閉
            </button>
          </div>
        </ModalBackdrop>
      ) : null}
      {itemModal?.mode === "edit" ? (
        <ItemFormModal
          title={`編輯項目 — ${itemModal.row.name}`}
          mode="update"
          categories={categories}
          defaults={itemModal.row}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}
      {itemModal?.mode === "delete" ? (
        <ItemDeleteModal
          row={itemModal.row}
          onClose={() => setItemModal(null)}
          onDeleted={() => {
            setItemModal(null);
            refresh();
          }}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}
    </div>
  );
}

function CategoryDeleteModal({
  row,
  onClose,
  onDeleted,
  isPending,
  startTransition,
}: {
  row: AccountingCategoryDTO;
  onClose: () => void;
  onDeleted: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalBackdrop title="刪除類別" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirm(`確定刪除類別「${row.name}」？其下 ${row.itemCount} 筆項目將一併刪除。`)) return;
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await saveAccountingCategory(fd);
              onDeleted();
            } catch (err) {
              setError(err instanceof Error ? err.message : "刪除失敗");
            }
          });
        }}
      >
        <input type="hidden" name="mode" value="delete" />
        <input type="hidden" name="id" value={row.id} />
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          將刪除 <strong>{row.code}</strong> — {row.name}（含下層項目）。
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-zinc-600">
            取消
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
            {isPending ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

function ItemDeleteModal({
  row,
  onClose,
  onDeleted,
  isPending,
  startTransition,
}: {
  row: AccountingItemDTO;
  onClose: () => void;
  onDeleted: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalBackdrop title="刪除項目" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirm(`確定刪除項目「${row.name}」？`)) return;
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await saveAccountingItem(fd);
              onDeleted();
            } catch (err) {
              setError(err instanceof Error ? err.message : "刪除失敗");
            }
          });
        }}
      >
        <input type="hidden" name="mode" value="delete" />
        <input type="hidden" name="id" value={row.id} />
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          將刪除 <strong>{row.code}</strong> — {row.name}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-zinc-600">
            取消
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
            {isPending ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

function CategoryFormModal({
  title,
  mode,
  defaults,
  onClose,
  onSaved,
  isPending,
  startTransition,
}: {
  title: string;
  mode: "create" | "update";
  defaults: AccountingCategoryDTO | null;
  onClose: () => void;
  onSaved: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalBackdrop title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await saveAccountingCategory(fd);
              onSaved();
            } catch (err) {
              setError(err instanceof Error ? err.message : "儲存失敗");
            }
          });
        }}
      >
        {mode === "update" && defaults ? (
          <>
            <input type="hidden" name="mode" value="update" />
            <input type="hidden" name="id" value={defaults.id} />
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">類別代碼</span>
          <input
            name="code"
            required
            defaultValue={defaults?.code ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">類別名稱</span>
          <input
            name="name"
            required
            defaultValue={defaults?.name ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">類型</span>
          <TypeSelect name="type" defaultValue={defaults?.type ?? "Expense"} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">排序</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={defaults?.sortOrder ?? 0}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
            取消
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isPending ? "儲存中…" : mode === "create" ? "新增" : "儲存"}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

function ItemFormModal({
  title,
  mode,
  categories,
  defaults,
  onClose,
  onSaved,
  isPending,
  startTransition,
}: {
  title: string;
  mode: "create" | "update";
  categories: AccountingCategoryDTO[];
  defaults: AccountingItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalBackdrop title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await saveAccountingItem(fd);
              onSaved();
            } catch (err) {
              setError(err instanceof Error ? err.message : "儲存失敗");
            }
          });
        }}
      >
        {mode === "update" && defaults ? (
          <>
            <input type="hidden" name="mode" value="update" />
            <input type="hidden" name="id" value={defaults.id} />
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">所屬類別</span>
          <select
            name="categoryId"
            required
            defaultValue={defaults?.categoryId ?? categories[0]?.id ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">項目代碼</span>
          <input
            name="code"
            required
            defaultValue={defaults?.code ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">項目名稱</span>
          <input
            name="name"
            required
            defaultValue={defaults?.name ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">說明（選填）</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={defaults?.description ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">排序</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={defaults?.sortOrder ?? 0}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" value="on" defaultChecked={defaults?.isActive ?? true} />
          啟用
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
            取消
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isPending ? "儲存中…" : mode === "create" ? "新增" : "儲存"}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
