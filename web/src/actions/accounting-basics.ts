"use server";



import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { z } from "zod";



import { auth } from "@/auth";

import { getDb } from "@/db";

import { accountingCompanySettings, accountingPeriods, ptCurrencies } from "@/db/schema";

import { canEditSettings } from "@/lib/authz";



async function requireSettingsEditor() {

  const session = await auth();

  if (!session?.user?.id || !canEditSettings(session)) {

    throw new Error("Forbidden");

  }

  return session;

}



export async function ensureAccountingCompanySettingsRow() {

  const db = getDb();

  const [row] = await db.select().from(accountingCompanySettings).limit(1);

  if (row) return row;

  const y = new Date().getFullYear();

  const [ins] = await db

    .insert(accountingCompanySettings)

    .values({

      currentFiscalYear: y,

      baseCurrencyIso: "TWD",

    })

    .returning();

  return ins;

}



const companySettingsSchema = z.object({

  currentFiscalYear: z.coerce.number().int().min(2000).max(2100),

  baseCurrencyIso: z

    .string()

    .min(3)

    .max(12)

    .regex(/^[A-Z0-9]+$/i, "ISO 碼僅能包含英數"),

});



export async function saveAccountingCompanySettings(formData: FormData): Promise<void> {

  await requireSettingsEditor();

  const parsed = companySettingsSchema.safeParse({

    currentFiscalYear: formData.get("currentFiscalYear"),

    baseCurrencyIso: (formData.get("baseCurrencyIso")?.toString() ?? "TWD").trim().toUpperCase(),

  });

  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join("; "));



  const db = getDb();

  const iso = parsed.data.baseCurrencyIso;

  const [cur] = await db

    .select({ id: ptCurrencies.id })

    .from(ptCurrencies)

    .where(eq(ptCurrencies.isoCode, iso))

    .limit(1);

  if (!cur) throw new Error(`本位幣 ${iso} 尚未在「文件主檔 → 幣別與匯率」建立`);



  const existing = await ensureAccountingCompanySettingsRow();

  await db

    .update(accountingCompanySettings)

    .set({

      currentFiscalYear: parsed.data.currentFiscalYear,

      baseCurrencyIso: iso,

      updatedAt: new Date(),

    })

    .where(eq(accountingCompanySettings.id, existing.id));



  revalidatePath("/dashboard/account/accounting-basics");

}



const periodSchema = z.object({

  yearMonth: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, "格式須為 yyyy-MM"),

  closed: z.enum(["0", "1"]),

});



export async function saveAccountingPeriodClosed(formData: FormData): Promise<void> {

  await requireSettingsEditor();

  const parsed = periodSchema.safeParse({

    yearMonth: formData.get("yearMonth"),

    closed: formData.get("closed")?.toString() === "1" ? "1" : "0",

  });

  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join("; "));

  const isPeriodClosed = parsed.data.closed === "1";
  const now = new Date();
  const db = getDb();

  await db
    .insert(accountingPeriods)
    .values({
      yearMonth: parsed.data.yearMonth,
      isClosed: isPeriodClosed,
      closedAt: isPeriodClosed ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [accountingPeriods.yearMonth],
      set: {
        isClosed: isPeriodClosed,
        closedAt: isPeriodClosed ? now : null,
        updatedAt: now,
      },
    });



  revalidatePath("/dashboard/account/accounting-basics");

}

