"use server";



import bcrypt from "bcryptjs";

import { revalidatePath } from "next/cache";

import { asc, eq } from "drizzle-orm";

import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { accountingCategories, accountingItems, organizations, userRoles, users } from "@/db/schema";

import { canEditSettings, canManageUsers } from "@/lib/authz";



async function requireSettings() {

  const session = await auth();

  if (!session?.user?.id || !canEditSettings(session)) {

    throw new Error("Forbidden");

  }

  return session;

}



async function requireUsersAdmin() {

  const session = await auth();

  if (!session?.user?.id || !canManageUsers(session)) {

    throw new Error("Forbidden");

  }

  return session;

}

function revalidateAccountingManagementPages() {
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/account/accounting-categories-settings");
}

export async function saveOrganization(formData: FormData): Promise<void> {
  await requireSettings();
  const db = getDb();
  const name = formData.get("name")?.toString().trim() ?? "";
  if (!name) throw new Error("Name required");

  const [first] = await db.select().from(organizations).orderBy(asc(organizations.id)).limit(1);
  if (!first) {
    await db.insert(organizations).values({
      name,
      taxId: formData.get("taxId")?.toString() || undefined,
      address: formData.get("address")?.toString() || undefined,
      phone: formData.get("phone")?.toString() || undefined,
      email: formData.get("email")?.toString() || undefined,
      website: formData.get("website")?.toString() || undefined,
      bankName: formData.get("bankName")?.toString() || undefined,
      bankAccount: formData.get("bankAccount")?.toString() || undefined,
      notes: formData.get("notes")?.toString() || undefined,
    });
  } else {
    await db
      .update(organizations)
      .set({
        name,
        taxId: formData.get("taxId")?.toString() || null,
        address: formData.get("address")?.toString() || null,
        phone: formData.get("phone")?.toString() || null,
        email: formData.get("email")?.toString() || null,
        website: formData.get("website")?.toString() || null,
        bankName: formData.get("bankName")?.toString() || null,
        bankAccount: formData.get("bankAccount")?.toString() || null,
        notes: formData.get("notes")?.toString() || null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, first.id));
  }
  revalidatePath("/dashboard/enterprise");
  revalidatePath("/dashboard");
}

export async function saveAccountingCategory(formData: FormData): Promise<void> {

  await requireSettings();

  const mode = formData.get("mode")?.toString();

  const cid = formData.get("id")?.toString();



  const db = getDb();



  if (mode === "delete" && cid) {

    await db.delete(accountingCategories).where(eq(accountingCategories.id, cid));

    revalidateAccountingManagementPages();

    return;

  }



  const catSchema = z.object({

    code: z.string().min(1),

    name: z.string().min(1),

    type: z.enum(["Asset", "Liability", "Equity", "Revenue", "Expense"]),

    sortOrder: z.coerce.number().int().optional(),

  });



  const parsed = catSchema.safeParse({

    code: formData.get("code"),

    name: formData.get("name"),

    type: formData.get("type"),

    sortOrder: formData.get("sortOrder"),

  });

  if (!parsed.success) throw new Error(parsed.error.message);



  if (mode === "update" && cid) {

    await db

      .update(accountingCategories)

      .set({

        categoryCode: parsed.data.code,

        categoryName: parsed.data.name,

        accountType: parsed.data.type,

        sortOrder: parsed.data.sortOrder ?? 0,

        updatedAt: new Date(),

      })

      .where(eq(accountingCategories.id, cid));

    revalidateAccountingManagementPages();

    return;

  }



  await db.insert(accountingCategories).values({

    categoryCode: parsed.data.code,

    categoryName: parsed.data.name,

    accountType: parsed.data.type,

    sortOrder: parsed.data.sortOrder ?? 0,

    updatedAt: new Date(),

  });

  revalidateAccountingManagementPages();

}



export async function saveAccountingItem(formData: FormData): Promise<void> {

  await requireSettings();

  const mode = formData.get("mode")?.toString();

  const itemId = formData.get("id")?.toString();



  const db = getDb();



  if (mode === "delete" && itemId) {

    await db.delete(accountingItems).where(eq(accountingItems.id, itemId));

    revalidateAccountingManagementPages();

    return;

  }



  const itemSchema = z.object({

    categoryId: z.string().uuid(),

    code: z.string().min(1),

    name: z.string().min(1),

    description: z.string().optional(),

    sortOrder: z.coerce.number().int().optional(),

    isActive: z.enum(["on"]).optional(),

  });



  const parsed = itemSchema.safeParse({

    categoryId: formData.get("categoryId"),

    code: formData.get("code"),

    name: formData.get("name"),

    description: formData.get("description") ?? "",

    sortOrder: formData.get("sortOrder"),

    isActive: formData.get("isActive")?.toString() === "on" ? "on" : undefined,

  });

  if (!parsed.success) throw new Error(parsed.error.message);



  if (mode === "update" && itemId) {

    await db

      .update(accountingItems)

      .set({

        categoryId: parsed.data.categoryId,

        code: parsed.data.code,

        name: parsed.data.name,

        description: parsed.data.description || null,

        sortOrder: parsed.data.sortOrder ?? 0,

        isActive: parsed.data.isActive === "on",

      })

      .where(eq(accountingItems.id, itemId));

    revalidateAccountingManagementPages();

    return;

  }



  await db.insert(accountingItems).values({

    categoryId: parsed.data.categoryId,

    code: parsed.data.code,

    name: parsed.data.name,

    description: parsed.data.description || null,

    sortOrder: parsed.data.sortOrder ?? 0,

    isActive: formData.get("isActive") === "on",

  });

  revalidateAccountingManagementPages();

}



export async function saveUser(formData: FormData): Promise<void> {

  await requireUsersAdmin();

  const mode = formData.get("mode")?.toString();

  const id = formData.get("userId")?.toString();



  const db = getDb();



  if (mode === "delete" && id) {

    await db.delete(users).where(eq(users.id, id));

    revalidatePath("/dashboard/users");

    return;

  }



  if (mode === "toggleActive" && id) {

    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (u) {

      await db.update(users).set({ isActive: !u.isActive, updatedAt: new Date() }).where(eq(users.id, id));

    }

    revalidatePath("/dashboard/users");

    return;

  }



  const userSchema = z.object({

    email: z.string().email(),

    name: z.string().min(1),

    password: z.string().min(8).optional(),

    roleIds: z.array(z.string().uuid()).optional(),

  });



  const roleIdsRaw = formData.getAll("roleIds").map(String).filter(Boolean);



  const pwdRaw = formData.get("password")?.toString().trim();



  const parsed = userSchema.safeParse({

    email: formData.get("email"),

    name: formData.get("name"),

    password: pwdRaw || undefined,

    roleIds: roleIdsRaw.length ? roleIdsRaw : [],

  });

  if (!parsed.success) throw new Error(parsed.error.message);



  if (mode === "create") {

    if (!parsed.data.password) throw new Error("Password required for new user");

    const hash = await bcrypt.hash(parsed.data.password, 10);

    const normalized = parsed.data.email.trim().toLowerCase();

    const [created] = await db

      .insert(users)

      .values({

        email: normalized,

        name: parsed.data.name,

        passwordHash: hash,

      })

      .returning({ id: users.id });



    if (created && parsed.data.roleIds?.length) {

      for (const rid of parsed.data.roleIds) {

        await db.insert(userRoles).values({ userId: created.id, roleId: rid });

      }

    }

    revalidatePath("/dashboard/users");

    return;

  }



  if (mode === "updateRoles" && id) {

    await db.delete(userRoles).where(eq(userRoles.userId, id));

    for (const rid of parsed.data.roleIds ?? []) {

      await db.insert(userRoles).values({ userId: id, roleId: rid });

    }

    revalidatePath("/dashboard/users");

    return;

  }



  throw new Error("Unknown action");

}

