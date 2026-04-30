"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customerFollowUpActivities, customers } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

async function requireSalesEditor() {
  const session = await auth();
  if (!session?.user?.id || !canEditSales(session)) {
    throw new Error("Forbidden");
  }
  return session;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

const customerUpsertSchema = z.object({
  name: z.string().min(1).max(300),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().max(320).optional(),
  address: z.string().optional(),
  organizationId: z.string().uuid().optional().or(z.literal("")),
  leadSourceId: z.string().uuid().optional().or(z.literal("")),
  customerGroupId: z.string().uuid().optional().or(z.literal("")),
  followUpStatusId: z.string().uuid().optional().or(z.literal("")),
  lifecycle: z.enum(["potential", "negotiating", "active", "dormant", "churned"]),
  tagsRaw: z.string().optional(),
  valueTier: z.enum(["high", "medium", "low"]).optional().or(z.literal("")),
  assignedToUserId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

/** 客戶主檔：新增／更新／刪除（業務／管理員） */
export async function saveCustomer(formData: FormData): Promise<void> {
  const session = await requireSalesEditor();
  const mode = formData.get("mode")?.toString();
  const stayOnList = formData.get("navigation")?.toString() === "list";
  const db = getDb();

  if (mode === "delete") {
    const id = formData.get("id")?.toString();
    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) throw new Error("Invalid id");
    await db.delete(customers).where(eq(customers.id, idParsed.data));
    revalidatePath("/dashboard/customers");
    if (!stayOnList) {
      redirect("/dashboard/customers");
    }
    return;
  }

  const parsed = customerUpsertSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    leadSourceId: formData.get("leadSourceId") ?? "",
    customerGroupId: formData.get("customerGroupId") ?? "",
    followUpStatusId: formData.get("followUpStatusId") ?? "",
    lifecycle: formData.get("lifecycle"),
    tagsRaw: formData.get("tags")?.toString() ?? "",
    valueTier: formData.get("valueTier") ?? "",
    assignedToUserId: formData.get("assignedToUserId") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.message);

  const emptyToNull = (s: string | undefined) =>
    !s || s.trim() === "" ? null : s.trim();

  const uuidOrNull = (s: string | undefined) =>
    !s || s.trim() === "" ? null : s.trim();

  const tags = parseTags(parsed.data.tagsRaw ?? "");

  const row = {
    name: parsed.data.name.trim(),
    contactName: emptyToNull(parsed.data.contactName),
    phone: emptyToNull(parsed.data.phone),
    email: emptyToNull(parsed.data.email),
    address: emptyToNull(parsed.data.address),
    organizationId: uuidOrNull(parsed.data.organizationId) as string | null,
    leadSourceId: uuidOrNull(parsed.data.leadSourceId) as string | null,
    customerGroupId: uuidOrNull(parsed.data.customerGroupId) as string | null,
    followUpStatusId: uuidOrNull(parsed.data.followUpStatusId) as string | null,
    lifecycle: parsed.data.lifecycle,
    tags,
    valueTier:
      parsed.data.valueTier === "" || parsed.data.valueTier === undefined
        ? null
        : parsed.data.valueTier,
    assignedToUserId: uuidOrNull(parsed.data.assignedToUserId) as string | null,
    notes: emptyToNull(parsed.data.notes),
    updatedAt: new Date(),
  };

  if (mode === "update") {
    const id = formData.get("id")?.toString();
    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) throw new Error("Invalid id");
    await db.update(customers).set(row).where(eq(customers.id, idParsed.data));
    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${idParsed.data}`);
    return;
  }

  const [inserted] = await db
    .insert(customers)
    .values({
      ...row,
      assignedToUserId: row.assignedToUserId ?? session.user.id,
    })
    .returning({ id: customers.id });

  revalidatePath("/dashboard/customers");
  if (inserted && !stayOnList) {
    redirect(`/dashboard/customers/${inserted.id}`);
  }
}

const activitySchema = z.object({
  summary: z.string().min(1).max(5000),
  channel: z.enum(["phone", "visit", "meeting", "email", "other"]),
  occurredAt: z.string().min(1),
  nextFollowUpAt: z.string().optional(),
});

/** 跟進紀錄（電話／拜訪等）；後續可由模組 9 對 next_follow_up_at 發提醒 */
export async function saveFollowUpActivity(formData: FormData): Promise<void> {
  const session = await requireSalesEditor();
  const db = getDb();

  const customerIdRaw = formData.get("customerId")?.toString();
  const customerParsed = z.string().uuid().safeParse(customerIdRaw);
  if (!customerParsed.success) throw new Error("Invalid customer");

  const parsed = activitySchema.safeParse({
    summary: formData.get("summary"),
    channel: formData.get("channel"),
    occurredAt: formData.get("occurredAt"),
    nextFollowUpAt: formData.get("nextFollowUpAt")?.toString(),
  });
  if (!parsed.success) throw new Error(parsed.error.message);

  const occurred = new Date(parsed.data.occurredAt);
  if (Number.isNaN(occurred.getTime())) throw new Error("Invalid occurred time");

  let nextAt: Date | null = null;
  if (parsed.data.nextFollowUpAt && parsed.data.nextFollowUpAt.trim()) {
    const n = new Date(parsed.data.nextFollowUpAt);
    if (!Number.isNaN(n.getTime())) nextAt = n;
  }

  await db.insert(customerFollowUpActivities).values({
    customerId: customerParsed.data,
    createdByUserId: session.user.id,
    occurredAt: occurred,
    channel: parsed.data.channel,
    summary: parsed.data.summary.trim(),
    nextFollowUpAt: nextAt,
  });

  revalidatePath(`/dashboard/customers/${customerParsed.data}`);
}
