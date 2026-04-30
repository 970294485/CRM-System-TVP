"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmailRichEditor } from "./email-rich-editor";
import { normalizeManualEmails } from "@/lib/manual-email-list";

const TARGET_ALL = "__all__";

export type EmailCampaignGroupOption = { id: string; name: string };

type QueueItem = {
  id: string;
  customerId: string | null;
  customerName: string;
  emailAddress: string;
  customizedSubject: string;
  customizedBodyHtml: string;
  status: string;
};

export function EmailCampaignManager({
  groups,
  smtpConfigured,
}: {
  groups: EmailCampaignGroupOption[];
  /** 由伺服器讀取 SMTP 環境變數，供提示用 */
  smtpConfigured: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState("");
  const [audienceMode, setAudienceMode] = useState<"group" | "manual">("group");
  const [targetGroup, setTargetGroup] = useState<string>(TARGET_ALL);
  const [manualEmailsText, setManualEmailsText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [loading, setLoading] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = queue.find((q) => q.id === selectedId) ?? null;

  const flushSave = useCallback(
    async (queueLogId: string, html: string, subj?: string) => {
      try {
        const res = await fetch("/api/marketing/emails", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queueLogId,
            customizedBodyHtml: html,
            ...(subj !== undefined ? { customizedSubject: subj } : {}),
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "自動儲存失敗");
      }
    },
    []
  );

  const scheduleSaveBody = useCallback(
    (queueLogId: string, html: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(queueLogId, html);
        setQueue((prev) =>
          prev.map((q) => (q.id === queueLogId ? { ...q, customizedBodyHtml: html } : q))
        );
      }, 550);
    },
    [flushSave]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const insertVarInSubject = () => {
    setSubject((s) => (s ? `${s}{{customer_name}}` : "{{customer_name}}"));
  };

  const runPreview = async () => {
    const sub = subject.trim();
    if (!sub) {
      toast.error("請填寫郵件主旨");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        action: "preview",
        subject: sub,
        baseBodyHtml: bodyHtml,
      };
      if (audienceMode === "manual") {
        const list = normalizeManualEmails([manualEmailsText]);
        if (list.length === 0) {
          toast.error("請輸入至少一個有效信箱（每行一個，或以逗號／分號分隔）");
          setLoading(false);
          return;
        }
        payload.manualEmails = list;
      } else {
        payload.targetGroup = targetGroup;
      }

      const res = await fetch("/api/marketing/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        campaignId?: string;
        queue?: QueueItem[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (!data.campaignId || !data.queue) {
        throw new Error("回應格式異常");
      }
      setCampaignId(data.campaignId);
      setQueue(data.queue);
      setSelectedId(data.queue[0]?.id ?? null);
      setStep(2);
      toast.success(`已建立 ${data.queue.length} 筆發送預覽`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "產生預覽失敗");
    } finally {
      setLoading(false);
    }
  };

  const runSendAll = async () => {
    if (!campaignId) return;
    if (!smtpConfigured) {
      toast.error("尚未設定 SMTP（SMTP_HOST、SMTP_FROM），無法發送");
      return;
    }
    if (!confirm(`確定發送 ${queue.filter((q) => q.status === "Pending").length} 封 Pending 郵件？`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/marketing/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", campaignId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        failed?: number;
        results?: { ok: boolean; error?: string }[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success(`發送完成：成功 ${data.sent ?? 0}，失敗 ${data.failed ?? 0}`);
      setStep(1);
      setCampaignId(null);
      setQueue([]);
      setSelectedId(null);
      setSubject("");
      setBodyHtml("<p></p>");
      setTargetGroup(TARGET_ALL);
      setManualEmailsText("");
      setAudienceMode("group");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "發送失敗");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <StepBadge n={1} active={step === 1} label="撰寫內容" />
        <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
          →
        </span>
        <StepBadge n={2} active={step === 2} label="預覽與微調" />
      </div>

      {step === 1 ? (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">收件對象</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAudienceMode("group")}
                className={
                  audienceMode === "group"
                    ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                }
              >
                客戶分組
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode("manual")}
                className={
                  audienceMode === "manual"
                    ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                }
              >
                手動輸入信箱
              </button>
            </div>
          </div>

          {audienceMode === "group" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">受眾（客戶分組）</span>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="max-w-md rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value={TARGET_ALL}>全部客戶（僅含有效 Email）</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                信箱列表（每行一個，或以逗號、分號、中文頓號分隔）
              </span>
              <textarea
                value={manualEmailsText}
                onChange={(e) => setManualEmailsText(e.target.value)}
                rows={6}
                placeholder={"例如：\na@example.com\nb@company.com.tw"}
                className="max-w-2xl rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
              <p className="text-xs text-zinc-500">
                未建檔於客戶列表的地址亦可發送。變數「客戶名稱」預設為信箱 @ 前的帳號（無則顯示「貴客戶」）；「Email」為完整地址。
              </p>
            </label>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  郵件主旨（可插入客戶名稱、聯絡人、Email 等變數）
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  placeholder="例如：〇〇 您好，專屬優惠通知（〇〇 可由「插入客戶名稱」帶入）"
                />
              </label>
              <button
                type="button"
                onClick={insertVarInSubject}
                title="實際寫入：{{customer_name}}"
                className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-blue-700 dark:border-zinc-600 dark:text-blue-400"
              >
                插入客戶名稱
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">郵件內文（HTML）</p>
            <EmailRichEditor initialHtml={bodyHtml} onChange={setBodyHtml} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runPreview()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "產生中…" : "產生發送預覽"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[480px] flex-col gap-4 lg:flex-row">
          <div className="flex w-full flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80 lg:w-[280px]">
            <div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium dark:border-zinc-700">
              收件名單（{queue.length}）
            </div>
            <ul className="max-h-[60vh] flex-1 overflow-y-auto p-2 text-sm">
              {queue.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className={
                      selectedId === q.id
                        ? "w-full rounded-md bg-zinc-100 px-2 py-2 text-left dark:bg-zinc-800"
                        : "w-full rounded-md px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{q.customerName}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{q.emailAddress}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase text-zinc-400">
                      {q.customerId === null ? (
                        <span className="normal-case text-amber-700 dark:text-amber-400">手動信箱</span>
                      ) : null}
                      <span>{q.status}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-zinc-200 p-2 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCampaignId(null);
                  setQueue([]);
                  setSelectedId(null);
                }}
                className="w-full rounded-md border border-zinc-300 py-2 text-xs dark:border-zinc-600"
              >
                ← 返回編輯
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
            {selected ? (
              <>
                <p className="text-xs text-zinc-500">
                  修改內文後會約半秒自動儲存至伺服器（僅 Pending 可改）。
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">主旨（已替換變數，可再調整）</span>
                  <input
                    key={selected.id + selected.customizedSubject}
                    defaultValue={selected.customizedSubject}
                    disabled={selected.status !== "Pending"}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== selected.customizedSubject) {
                        void flushSave(selected.id, selected.customizedBodyHtml, v);
                        setQueue((prev) =>
                          prev.map((q) => (q.id === selected.id ? { ...q, customizedSubject: v } : q))
                        );
                      }
                    }}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <div>
                  <p className="mb-2 text-sm text-zinc-500">內文（可編輯）</p>
                  <EmailRichEditor
                    key={selected.id}
                    initialHtml={selected.customizedBodyHtml}
                    onChange={(html) => scheduleSaveBody(selected.id, html)}
                    disabled={selected.status !== "Pending"}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">請從左側選擇客戶。</p>
            )}

            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {!smtpConfigured ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                  提示：請設定 SMTP_HOST、SMTP_FROM（及選用的 SMTP_PORT、SMTP_USER、SMTP_PASS）後才能實際發信。
                </p>
              ) : null}
              <button
                type="button"
                disabled={sending || !campaignId || queue.every((q) => q.status !== "Pending")}
                onClick={() => void runSendAll()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {sending ? "發送中…" : "確認無誤，正式發送全數郵件"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ n, active, label }: { n: number; active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 dark:border-zinc-700"
      }
    >
      <span className="tabular-nums">{n}</span>
      {label}
    </span>
  );
}
