"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  numberSequences,
  ptCurrencies,
  ptMasterLookupEntries,
} from "@/db/schema";
import { formatDocumentSerial } from "@/lib/document-number";
import { getHongKongYmd } from "@/lib/hong-kong-time";
import { PT_PAYMENT_TERMS_SLUG, PT_SHIPPING_METHODS_SLUG } from "@/lib/pt-master-kinds";
import { canEditSettings } from "@/lib/authz";

async function requireSettingsEditor() {
  const session = await auth();
  if (!session?.user?.id || !canEditSettings(session)) {
    throw new Error("Forbidden");
  }
  return session;
}

const seqFieldsSchema = z.object({
  prefix: z.string(),
  suffix: z.string(),
  padLength: z.coerce.number().int().min(1).max(12),
  nextNumber: z.coerce.number().int().min(1),
  resetPolicy: z.enum(["never", "yearly"]),
  dateSegment: z.enum(["omit", "year", "year_month"]),
});

export async function saveNumberSequence(formData: FormData): Promise<void> {
  await requireSettingsEditor();
  const entityType = formData.get("entityType")?.toString() ?? "";
  if (!entityType) throw new Error("Missing entity type");

  const parsed = seqFieldsSchema.safeParse({
    prefix: formData.get("prefix") ?? "",
    suffix: formData.get("suffix") ?? "",
    padLength: formData.get("padLength"),
    nextNumber: formData.get("nextNumber"),
    resetPolicy: formData.get("resetPolicy"),
    dateSegment: formData.get("dateSegment"),
  });
  if (!parsed.success) throw new Error(parsed.error.message);

  const db = getDb();
  await db
    .update(numberSequences)
    .set({
      prefix: parsed.data.prefix,
      suffix: parsed.data.suffix,
      padLength: parsed.data.padLength,
      nextNumber: parsed.data.nextNumber,
      resetPolicy: parsed.data.resetPolicy,
      dateSegment: parsed.data.dateSegment,
      updatedAt: new Date(),
    })
    .where(eq(numberSequences.entityType, entityType));

  revalidatePath("/dashboard/doc-master");
}

export async function createNumberSequence(formData: FormData): Promise<void> {
  await requireSettingsEditor();
  const raw = formData.get("entityType")?.toString().trim().toLowerCase() ?? "";
  const entityParsed = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "類型鍵須為小寫字母開頭，僅含英數與底線")
    .safeParse(raw);
  if (!entityParsed.success) throw new Error(entityParsed.error.flatten().formErrors.join("; "));

  const parsed = seqFieldsSchema.safeParse({
    prefix: formData.get("prefix") ?? "",
    suffix: formData.get("suffix") ?? "",
    padLength: formData.get("padLength"),
    nextNumber: formData.get("nextNumber"),
    resetPolicy: formData.get("resetPolicy"),
    dateSegment: formData.get("dateSegment"),
  });
  if (!parsed.success) throw new Error(parsed.error.message);

  const db = getDb();
  const [exists] = await db
    .select({ id: numberSequences.id })
    .from(numberSequences)
    .where(eq(numberSequences.entityType, entityParsed.data))
    .limit(1);
  if (exists) throw new Error("此類型鍵已存在");

  await db.insert(numberSequences).values({
    entityType: entityParsed.data,
    prefix: parsed.data.prefix,
    suffix: parsed.data.suffix,
    padLength: parsed.data.padLength,
    nextNumber: parsed.data.nextNumber,
    resetPolicy: parsed.data.resetPolicy,
    dateSegment: parsed.data.dateSegment,
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/doc-master");
}

export async function deleteNumberSequence(formData: FormData): Promise<void> {
  await requireSettingsEditor();
  const idRaw = formData.get("id")?.toString() ?? "";
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) throw new Error("Invalid id");

  const db = getDb();
  await db.delete(numberSequences).where(eq(numberSequences.id, idParsed.data));

  revalidatePath("/dashboard/doc-master");
}

/**
 * Peek next issuance string without mutating counters (Hong Kong calendar for dated segments).
 */
export async function previewNextDocumentLabel(entityType: string): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(numberSequences)
    .where(eq(numberSequences.entityType, entityType))
    .limit(1);
  if (!row) return null;
  return formatDocumentSerial(row, row.nextNumber, new Date());
}

/**
 * Consume next sequence for `entityType`. Yearly resets (Hong Kong) applied before bump.
 */
export async function allocateNextDocumentNumber(entityType: string): Promise<{ code: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = getDb();
  let [row] = await db.select().from(numberSequences).where(eq(numberSequences.entityType, entityType)).limit(1);
  if (!row) throw new Error("Unknown numbering key");

  const { yyyy } = getHongKongYmd(new Date());

  if (row.resetPolicy === "yearly" && row.currentYear !== yyyy) {
    await db
      .update(numberSequences)
      .set({
        nextNumber: 1,
        currentYear: yyyy,
        updatedAt: new Date(),
      })
      .where(eq(numberSequences.entityType, entityType));
    [row] = await db.select().from(numberSequences).where(eq(numberSequences.entityType, entityType)).limit(1);
    if (!row) throw new Error("Sequence missing after yearly reset");
  }

  const issueSerial = row.nextNumber;

  const [upd] = await db
    .update(numberSequences)
    .set({
      nextNumber: sql`${numberSequences.nextNumber} + 1`,
      ...(row.resetPolicy === "yearly" ? { currentYear: yyyy } : {}),
      updatedAt: new Date(),
    })
    .where(eq(numberSequences.entityType, entityType))
    .returning();

  if (!upd) throw new Error("Concurrency issue");

  const code = formatDocumentSerial(row, issueSerial, new Date());
  return { code };
}

const dictKindSchema = z.enum([PT_PAYMENT_TERMS_SLUG, PT_SHIPPING_METHODS_SLUG]);

const dictRowSchema = z.object({
  label: z.string().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999999),
  isActive: z.enum(["on"]).optional(),
});

export async function savePtLookupEntry(formData: FormData): Promise<void> {
  await requireSettingsEditor();
  const mode = formData.get("mode")?.toString();
  const kindSlug = formData.get("dictKindSlug")?.toString().trim();

  const kindParsed = dictKindSchema.safeParse(kindSlug);
  if (!kindParsed.success) throw new Error("Invalid dictionary kind");

  const db = getDb();

  if (mode === "delete") {
    const id = formData.get("id")?.toString();
    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) throw new Error("Invalid id");
    await db.delete(ptMasterLookupEntries).where(eq(ptMasterLookupEntries.id, idParsed.data));
    revalidatePath("/dashboard/doc-master");
    return;
  }

  const labelRaw = formData.get("label")?.toString() ?? "";

  const rowParsed2 = dictRowSchema.safeParse({
    label: labelRaw.trim(),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive")?.toString() === "on" ? "on" : undefined,
  });
  if (!rowParsed2.success) throw new Error(rowParsed2.error.message);

  const active = rowParsed2.data.isActive === "on";

  if (mode === "update") {
    const id = formData.get("id")?.toString();
    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) throw new Error("Invalid id");
    await db
      .update(ptMasterLookupEntries)
      .set({
        dictionaryKindSlug: kindParsed.data,
        label: rowParsed2.data.label,
        sortOrder: rowParsed2.data.sortOrder,
        isActive: active,
        updatedAt: new Date(),
      })
      .where(eq(ptMasterLookupEntries.id, idParsed.data));
    revalidatePath("/dashboard/doc-master");
    return;
  }

  await db.insert(ptMasterLookupEntries).values({
    dictionaryKindSlug: kindParsed.data,
    label: rowParsed2.data.label,
    sortOrder: rowParsed2.data.sortOrder,
    isActive: active,
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/doc-master");
}

const currencySchema = z.object({
  isoCode: z.string().min(3).max(8).regex(/^[A-Z0-9]+$/),
  label: z.string().optional(),
  quoteTwdPerUnit: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.enum(["on"]).optional(),
});

export async function savePtCurrency(formData: FormData): Promise<void> {
  await requireSettingsEditor();
  const mode = formData.get("mode")?.toString();
  const id = formData.get("id")?.toString();
  const db = getDb();

  if (mode === "delete" && id) {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new Error("Invalid id");
    await db.delete(ptCurrencies).where(eq(ptCurrencies.id, parsed.data));
    revalidatePath("/dashboard/doc-master");
    revalidatePath("/dashboard/account/accounting-basics");
    return;
  }

  const parsed = currencySchema.safeParse({
    isoCode: (formData.get("isoCode")?.toString() ?? "").trim().toUpperCase(),
    label: formData.get("label"),
    quoteTwdPerUnit: formData.get("quoteTwdPerUnit"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) throw new Error(parsed.error.message);

  const rateRaw = parsed.data.quoteTwdPerUnit?.trim() ?? "";
  let quoteResolved: string | null = null;
  if (rateRaw.length > 0) {
    const n = Number(rateRaw);
    if (!Number.isFinite(n) || n <= 0) throw new Error("匯率須為大於 0 的數字");
    quoteResolved = rateRaw;
  }

  if (mode === "update" && id) {
    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) throw new Error("Invalid id");
    await db
      .update(ptCurrencies)
      .set({
        isoCode: parsed.data.isoCode,
        label: parsed.data.label || null,
        quoteTwdPerUnit:
          formData.get("quoteTwdPerUnit")?.toString().trim() === "" ? null : quoteResolved ?? undefined,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive === "on",
        updatedAt: new Date(),
      })
      .where(eq(ptCurrencies.id, idParsed.data));
    revalidatePath("/dashboard/doc-master");
    revalidatePath("/dashboard/account/accounting-basics");
    return;
  }

  await db.insert(ptCurrencies).values({
    isoCode: parsed.data.isoCode,
    label: parsed.data.label || null,
    quoteTwdPerUnit: quoteResolved,
    sortOrder: parsed.data.sortOrder ?? 0,
    isActive: formData.get("isActive") === "on",
  });
  revalidatePath("/dashboard/doc-master");
  revalidatePath("/dashboard/account/accounting-basics");
}

