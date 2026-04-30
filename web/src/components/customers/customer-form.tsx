"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { saveCustomer } from "@/actions/customers";

export type DictOption = { id: string; name: string; isActive?: boolean };
export type OrgOption = { id: string; name: string };
export type UserOption = { id: string; label: string };

export type CustomerFormDTO = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  organizationId: string | null;
  leadSourceId: string | null;
  customerGroupId: string | null;
  followUpStatusId: string | null;
  lifecycle: string;
  tags: string[];
  valueTier: string | null;
  assignedToUserId: string | null;
  notes: string | null;
};

const LIFECYCLE_OPTS: { value: string; label: string }[] = [
  { value: "potential", label: "潛在" },
  { value: "negotiating", label: "洽談中" },
  { value: "active", label: "成交／活躍" },
  { value: "dormant", label: "沉寂" },
  { value: "churned", label: "流失" },
];

function isNextRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

const VALUE_OPTS: { value: string; label: string }[] = [
  { value: "", label: "（未標示）" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const LIFECYCLE_READ_LABEL: Record<string, string> = {
  potential: "潛在",
  negotiating: "洽談中",
  active: "成交／活躍",
  dormant: "沉寂",
  churned: "流失",
};

const VALUE_READ_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

type FormState = { ok: true } | { ok: false; message: string } | null;

function ReadOnlyCustomerDetails({
  customer,
  sources,
  groups,
  statuses,
  orgs,
  users,
}: {
  customer: CustomerFormDTO;
  sources: DictOption[];
  groups: DictOption[];
  statuses: DictOption[];
  orgs: OrgOption[];
  users: UserOption[];
}) {
  const src = sources.find((s) => s.id === customer.leadSourceId)?.name;
  const grp = groups.find((s) => s.id === customer.customerGroupId)?.name;
  const st = statuses.find((s) => s.id === customer.followUpStatusId)?.name;
  const org = orgs.find((o) => o.id === customer.organizationId)?.name;
  const assignee = users.find((u) => u.id === customer.assignedToUserId)?.label;

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <dt className="text-zinc-500">客戶名稱</dt>
      <dd className="font-medium">{customer.name}</dd>
      <dt className="text-zinc-500">聯絡人</dt>
      <dd>{customer.contactName ?? "—"}</dd>
      <dt className="text-zinc-500">電話</dt>
      <dd>{customer.phone ?? "—"}</dd>
      <dt className="text-zinc-500">Email</dt>
      <dd>{customer.email ?? "—"}</dd>
      <dt className="text-zinc-500">地址</dt>
      <dd className="sm:col-span-2">{customer.address ?? "—"}</dd>
      <dt className="text-zinc-500">企業（組織）</dt>
      <dd>{org ?? "—"}</dd>
      <dt className="text-zinc-500">來源</dt>
      <dd>{src ?? "—"}</dd>
      <dt className="text-zinc-500">分組</dt>
      <dd>{grp ?? "—"}</dd>
      <dt className="text-zinc-500">跟進階段</dt>
      <dd>{st ?? "—"}</dd>
      <dt className="text-zinc-500">生命週期</dt>
      <dd>{LIFECYCLE_READ_LABEL[customer.lifecycle] ?? customer.lifecycle}</dd>
      <dt className="text-zinc-500">價值分級</dt>
      <dd>{customer.valueTier ? (VALUE_READ_LABEL[customer.valueTier] ?? customer.valueTier) : "—"}</dd>
      <dt className="text-zinc-500">負責人</dt>
      <dd>{assignee ?? "—"}</dd>
      <dt className="text-zinc-500">標籤</dt>
      <dd>{customer.tags?.length ? customer.tags.join("、") : "—"}</dd>
      <dt className="text-zinc-500">備註</dt>
      <dd className="sm:col-span-2 whitespace-pre-wrap">{customer.notes ?? "—"}</dd>
    </dl>
  );
}

export function CustomerForm({
  customer,
  sources,
  groups,
  statuses,
  orgs,
  users,
  editable,
  variant = "page",
  viewMode = false,
  onModalSaved,
  onModalCancel,
}: {
  customer: CustomerFormDTO | null;
  sources: DictOption[];
  groups: DictOption[];
  statuses: DictOption[];
  orgs: OrgOption[];
  users: UserOption[];
  editable: boolean;
  variant?: "page" | "modal";
  /** 檢視用：顯示完整唯讀欄位，不顯示「無編輯權限」提示 */
  viewMode?: boolean;
  onModalSaved?: () => void;
  onModalCancel?: () => void;
}) {
  const isNew = !customer;
  const tagsStr = customer?.tags?.length ? customer.tags.join("，") : "";
  const isModal = variant === "modal";

  const [state, formAction] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    try {
      await saveCustomer(formData);
      return { ok: true };
    } catch (e) {
      if (isNextRedirectError(e)) throw e;
      return { ok: false, message: e instanceof Error ? e.message : "操作失敗" };
    }
  }, null);

  useEffect(() => {
    if (state?.ok && isModal) {
      onModalSaved?.();
    }
  }, [state, isModal, onModalSaved]);

  if (viewMode && customer) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <ReadOnlyCustomerDetails
          customer={customer}
          sources={sources}
          groups={groups}
          statuses={statuses}
          orgs={orgs}
          users={users}
        />
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">您為唯讀權限，無法編輯客戶資料。</p>
        {customer ? (
          <ReadOnlyCustomerDetails
            customer={customer}
            sources={sources}
            groups={groups}
            statuses={statuses}
            orgs={orgs}
            users={users}
          />
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {isModal ? <input type="hidden" name="navigation" value="list" /> : null}
      {customer ? (
        <>
          <input type="hidden" name="mode" value="update" />
          <input type="hidden" name="id" value={customer.id} />
        </>
      ) : null}

      {state?.ok === false ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">客戶名稱 *</span>
          <input
            name="name"
            required
            defaultValue={customer?.name ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">聯絡人</span>
          <input
            name="contactName"
            defaultValue={customer?.contactName ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">電話</span>
          <input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">地址</span>
          <input
            name="address"
            defaultValue={customer?.address ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">企業（組織）</span>
          <select
            name="organizationId"
            defaultValue={customer?.organizationId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">（無）</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">來源</span>
          <select
            name="leadSourceId"
            defaultValue={customer?.leadSourceId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">（無）</option>
            {sources.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.isActive === false ? "（停用）" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">分組</span>
          <select
            name="customerGroupId"
            defaultValue={customer?.customerGroupId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">（無）</option>
            {groups.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.isActive === false ? "（停用）" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">跟進階段</span>
          <select
            name="followUpStatusId"
            defaultValue={customer?.followUpStatusId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">（無）</option>
            {statuses.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.isActive === false ? "（停用）" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">生命週期</span>
          <select
            name="lifecycle"
            required
            defaultValue={customer?.lifecycle ?? "potential"}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {LIFECYCLE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">價值分級</span>
          <select
            name="valueTier"
            defaultValue={customer?.valueTier ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {VALUE_OPTS.map((o) => (
              <option key={o.value || "empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">負責人</span>
          <select
            name="assignedToUserId"
            defaultValue={customer?.assignedToUserId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">（未指派）</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">標籤（逗號分隔）</span>
          <input
            name="tags"
            defaultValue={tagsStr}
            placeholder="如：重點，北區"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">備註</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={customer?.notes ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isNew ? "建立客戶" : "儲存變更"}
        </button>
        {isModal ? (
          <button
            type="button"
            onClick={onModalCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            取消
          </button>
        ) : (
          <Link
            href="/dashboard/customers"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            返回列表
          </Link>
        )}
      </div>
    </form>
  );
}
