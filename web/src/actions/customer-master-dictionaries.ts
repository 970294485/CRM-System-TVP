"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  customerFollowUpStatuses,
  customerGroups,
  customerLeadSources,
} from "@/db/schema";
import { canEditSales } from "@/lib/authz";

const KINDS = ["lead_source", "group", "follow_up_status"] as const;
export type CustomerDictionaryKind = (typeof KINDS)[number];

async function requireSalesEditor() {
  const session = await auth();
  if (!session?.user?.id || !canEditSales(session)) {
    throw new Error("Forbidden");
  }
  return session;
}

function tableForKind(kind: CustomerDictionaryKind) {
  switch (kind) {
    case "lead_source":
      return customerLeadSources;
    case "group":
      return customerGroups;
    case "follow_up_status":
      return customerFollowUpStatuses;
  }
}

/** 客戶主檔下拉選項：分組／跟進階段／來源 的新增、更新、刪除 */
export async function saveCustomerDictionaryItem(formData: FormData): Promise<void> {
  await requireSalesEditor();
  const db = getDb();

  const mode = formData.get("mode")?.toString();
  const kindRaw = formData.get("kind")?.toString();
  const kindParsed = z.enum(KINDS).safeParse(kindRaw);
  if (!kindParsed.success) throw new Error("無效的類型");

  const kind = kindParsed.data;
  const table = tableForKind(kind);

  if (mode === "delete") {
    const idParsed = z.string().uuid().safeParse(formData.get("id")?.toString());
    if (!idParsed.success) throw new Error("無效的 id");
    await db.delete(table).where(eq(table.id, idParsed.data));
    revalidatePath("/dashboard/customers");
    return;
  }

  if (mode === "create") {
    const nameParsed = z.string().min(1).max(200).safeParse(formData.get("name")?.toString()?.trim());
    if (!nameParsed.success) throw new Error("名稱為必填（1–200 字）");
    const sortRaw = formData.get("sortOrder")?.toString();
    let sortOrder = 0;
    if (sortRaw !== undefined && sortRaw !== "") {
      const s = z.coerce.number().int().min(0).max(9999).safeParse(sortRaw);
      if (s.success) sortOrder = s.data;
    }
    await db.insert(table).values({
      name: nameParsed.data,
      sortOrder,
      isActive: true,
    });
    revalidatePath("/dashboard/customers");
    return;
  }

  if (mode === "update") {
    const idParsed = z.string().uuid().safeParse(formData.get("id")?.toString());
    if (!idParsed.success) throw new Error("無效的 id");
    const nameParsed = z.string().min(1).max(200).safeParse(formData.get("name")?.toString()?.trim());
    if (!nameParsed.success) throw new Error("名稱為必填（1–200 字）");
    const sortRaw = formData.get("sortOrder")?.toString();
    let sortOrder = 0;
    if (sortRaw !== undefined && sortRaw !== "") {
      const s = z.coerce.number().int().min(0).max(9999).safeParse(sortRaw);
      if (s.success) sortOrder = s.data;
    }
    const activeRaw = formData.get("isActive")?.toString();
    const isActive = activeRaw === "false" ? false : true;

    await db
      .update(table)
      .set({
        name: nameParsed.data,
        sortOrder,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(table.id, idParsed.data));
    revalidatePath("/dashboard/customers");
    return;
  }

  throw new Error("無效的操作");
}
