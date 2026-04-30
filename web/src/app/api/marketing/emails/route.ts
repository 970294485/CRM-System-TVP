import { NextResponse } from "next/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers, emailCampaigns, emailQueueLogs } from "@/db/schema";
import { applyEmailTemplate } from "@/lib/email-template";
import { canEditSales } from "@/lib/authz";
import { normalizeManualEmails, templateVarsFromManualEmail } from "@/lib/manual-email-list";
import { sendMarketingEmail } from "@/lib/marketing-mail";

export const runtime = "nodejs";

const TARGET_ALL = "__all__";
const TARGET_MANUAL = "__manual__";

const previewSchema = z.object({
  action: z.literal("preview"),
  subject: z.string().min(1).max(500),
  baseBodyHtml: z.string(),
  targetGroup: z.union([z.string().uuid(), z.literal(TARGET_ALL)]).optional(),
  /** 若提供且經解析後非空，則改為手動信箱模式（略過 targetGroup） */
  manualEmails: z.array(z.string()).max(500).optional(),
});

const sendSchema = z.object({
  action: z.literal("send"),
  campaignId: z.string().uuid(),
});

const putSchema = z.object({
  queueLogId: z.string().uuid(),
  customizedBodyHtml: z.string(),
  customizedSubject: z.string().min(1).max(500).optional(),
});

function templateVarsFromCustomer(row: {
  name: string;
  contactName: string | null;
  email: string | null;
}): Record<string, string> {
  return {
    customer_name: row.name ?? "",
    contact_name: row.contactName?.trim() ?? "",
    email: row.email?.trim() ?? "",
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditSales(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const previewParsed = previewSchema.safeParse(body);
  if (previewParsed.success) {
    const db = getDb();
    const { subject, baseBodyHtml } = previewParsed.data;
    const manualList = normalizeManualEmails(previewParsed.data.manualEmails);
    const useManual = manualList.length > 0;

    if (!useManual) {
      const targetGroup = previewParsed.data.targetGroup;
      if (targetGroup === undefined) {
        return NextResponse.json(
          { error: "請選擇客戶分組，或於「手動輸入信箱」填寫至少一個有效地址" },
          { status: 400 }
        );
      }

      const parts = [
        isNotNull(customers.email),
        sql`char_length(trim(${customers.email})) > 0`,
      ];
      if (targetGroup !== TARGET_ALL) {
        parts.push(eq(customers.customerGroupId, targetGroup));
      }

      const recipientRows = await db
        .select({
          id: customers.id,
          name: customers.name,
          contactName: customers.contactName,
          email: customers.email,
        })
        .from(customers)
        .where(and(...parts));

      if (recipientRows.length === 0) {
        return NextResponse.json({ error: "此受眾沒有含有效 Email 的客戶" }, { status: 400 });
      }

      const [campaign] = await db
        .insert(emailCampaigns)
        .values({
          subject: subject.trim(),
          baseBodyHtml,
          targetGroup,
          status: "Pending_Review",
          updatedAt: new Date(),
        })
        .returning();

      if (!campaign) {
        return NextResponse.json({ error: "建立活動失敗" }, { status: 500 });
      }

      const queueValues = recipientRows.map((c) => {
        const vars = templateVarsFromCustomer(c);
        return {
          campaignId: campaign.id,
          customerId: c.id,
          emailAddress: c.email!.trim(),
          customizedSubject: applyEmailTemplate(subject.trim(), vars),
          customizedBodyHtml: applyEmailTemplate(baseBodyHtml, vars),
          status: "Pending" as const,
        };
      });

      await db.insert(emailQueueLogs).values(queueValues);

      const queue = await db
        .select({
          id: emailQueueLogs.id,
          customerId: emailQueueLogs.customerId,
          emailAddress: emailQueueLogs.emailAddress,
          customizedSubject: emailQueueLogs.customizedSubject,
          customizedBodyHtml: emailQueueLogs.customizedBodyHtml,
          status: emailQueueLogs.status,
        })
        .from(emailQueueLogs)
        .where(eq(emailQueueLogs.campaignId, campaign.id));

      const nameById = new Map(recipientRows.map((r) => [r.id, r.name]));

      return NextResponse.json({
        campaignId: campaign.id,
        campaign: {
          id: campaign.id,
          subject: campaign.subject,
          status: campaign.status,
          targetGroup: campaign.targetGroup,
        },
        queue: queue.map((q) => ({
          ...q,
          customerName: q.customerId ? (nameById.get(q.customerId) ?? "—") : "—",
        })),
      });
    }

    const [campaign] = await db
      .insert(emailCampaigns)
      .values({
        subject: subject.trim(),
        baseBodyHtml,
        targetGroup: TARGET_MANUAL,
        status: "Pending_Review",
        updatedAt: new Date(),
      })
      .returning();

    if (!campaign) {
      return NextResponse.json({ error: "建立活動失敗" }, { status: 500 });
    }

    const queueValues = manualList.map((email) => {
      const vars = templateVarsFromManualEmail(email);
      return {
        campaignId: campaign.id,
        customerId: null as string | null,
        emailAddress: email,
        customizedSubject: applyEmailTemplate(subject.trim(), vars),
        customizedBodyHtml: applyEmailTemplate(baseBodyHtml, vars),
        status: "Pending" as const,
      };
    });

    await db.insert(emailQueueLogs).values(queueValues);

    const queue = await db
      .select({
        id: emailQueueLogs.id,
        customerId: emailQueueLogs.customerId,
        emailAddress: emailQueueLogs.emailAddress,
        customizedSubject: emailQueueLogs.customizedSubject,
        customizedBodyHtml: emailQueueLogs.customizedBodyHtml,
        status: emailQueueLogs.status,
      })
      .from(emailQueueLogs)
      .where(eq(emailQueueLogs.campaignId, campaign.id));

    return NextResponse.json({
      campaignId: campaign.id,
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        targetGroup: campaign.targetGroup,
      },
      queue: queue.map((q) => ({
        ...q,
        customerName: q.emailAddress.split("@")[0] || "手動收件",
      })),
    });
  }

  const sendParsed = sendSchema.safeParse(body);
  if (sendParsed.success) {
    const db = getDb();
    const { campaignId } = sendParsed.data;

    const pending = await db
      .select()
      .from(emailQueueLogs)
      .where(and(eq(emailQueueLogs.campaignId, campaignId), eq(emailQueueLogs.status, "Pending")));

    if (pending.length === 0) {
      return NextResponse.json({ error: "沒有待發送（Pending）的佇列" }, { status: 400 });
    }

    const results = await Promise.all(
      pending.map(async (row) => {
        try {
          await sendMarketingEmail(row.emailAddress, row.customizedSubject, row.customizedBodyHtml);
          await db.update(emailQueueLogs).set({ status: "Sent" }).where(eq(emailQueueLogs.id, row.id));
          return { id: row.id, ok: true as const };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await db.update(emailQueueLogs).set({ status: "Failed" }).where(eq(emailQueueLogs.id, row.id));
          return { id: row.id, ok: false as const, error: msg };
        }
      })
    );

    await db
      .update(emailCampaigns)
      .set({ status: "Completed", updatedAt: new Date() })
      .where(eq(emailCampaigns.id, campaignId));

    return NextResponse.json({
      ok: true,
      results,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    });
  }

  return NextResponse.json({ error: "請使用 action: preview 或 send" }, { status: 400 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditSales(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const { queueLogId, customizedBodyHtml, customizedSubject } = parsed.data;

  const [row] = await db.select().from(emailQueueLogs).where(eq(emailQueueLogs.id, queueLogId)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "找不到佇列紀錄" }, { status: 404 });
  }
  if (row.status !== "Pending") {
    return NextResponse.json({ error: "僅能修改狀態為 Pending 的佇列" }, { status: 409 });
  }

  await db
    .update(emailQueueLogs)
    .set({
      customizedBodyHtml,
      ...(customizedSubject !== undefined ? { customizedSubject: customizedSubject.trim() } : {}),
    })
    .where(eq(emailQueueLogs.id, queueLogId));

  return NextResponse.json({ ok: true });
}
