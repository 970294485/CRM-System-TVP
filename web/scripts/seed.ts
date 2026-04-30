/**
 * Seeds roles, default number sequences, a placeholder organization row,
 * and (only when no users exist) a dev default admin.
 * Run from web/: npm run db:seed (requires DATABASE_URL in .env.local)
 */
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { and, asc, count, eq } from "drizzle-orm";
import { resolve } from "path";

import { getDb } from "../src/db/index";
import * as schema from "../src/db/schema";
import { ensureDemoCustomers } from "./ensure-demo-customers";

/** Login email must be a valid email format; password as requested for dev only. */
const DEFAULT_ADMIN_EMAIL = "admin@example.com";
const DEFAULT_ADMIN_PASSWORD = "admin";

config({ path: resolve(process.cwd(), ".env") });
/* Override shell / CI placeholders so Neon URL from .env.local always wins */
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const ensureDevAdmin = process.argv.includes("--ensure-dev-admin");

async function ensureDevAdminAccount() {
  const db = getDb();
  const [superRole] = await db.select().from(schema.roles).where(eq(schema.roles.slug, "super_admin")).limit(1);
  if (!superRole) {
    throw new Error("super_admin role missing; run seed roles first.");
  }
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(schema.users)
      .values({
        email: DEFAULT_ADMIN_EMAIL,
        passwordHash,
        name: "Administrator",
        isActive: true,
      })
      .returning({ id: schema.users.id });
    if (created) {
      await db.insert(schema.userRoles).values({ userId: created.id, roleId: superRole.id });
    }
    console.log(`Created dev admin — ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
    return;
  }

  await db
    .update(schema.users)
    .set({ passwordHash, isActive: true, updatedAt: new Date() })
    .where(eq(schema.users.id, existing.id));

  const [link] = await db
    .select()
    .from(schema.userRoles)
    .where(and(eq(schema.userRoles.userId, existing.id), eq(schema.userRoles.roleId, superRole.id)))
    .limit(1);
  if (!link) {
    await db.insert(schema.userRoles).values({ userId: existing.id, roleId: superRole.id });
  }
  console.log(`Updated dev admin password — ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

async function main() {
  const db = getDb();

  const roleDefs = [
    { name: "Super Admin", slug: "super_admin", description: "Full access" },
    { name: "Admin", slug: "admin", description: "Manage settings and users" },
    { name: "Sales", slug: "sales", description: "Sales modules" },
    { name: "Finance", slug: "finance", description: "Finance and accounting" },
    { name: "Viewer", slug: "viewer", description: "Read-only" },
  ];

  for (const r of roleDefs) {
    const existing = await db.select().from(schema.roles).where(eq(schema.roles.slug, r.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.roles).values(r);
      console.log("Inserted role:", r.slug);
    }
  }

  const seqDefs = [
    { entityType: "quotation", prefix: "QT-", suffix: "", padLength: 6 },
    { entityType: "invoice", prefix: "INV-", suffix: "", padLength: 6 },
    { entityType: "payment_request", prefix: "PR-", suffix: "", padLength: 6 },
    { entityType: "delivery_note", prefix: "DN-", suffix: "", padLength: 6 },
    { entityType: "purchase", prefix: "PO-", suffix: "", padLength: 6 },
  ];

  for (const s of seqDefs) {
    const existing = await db
      .select()
      .from(schema.numberSequences)
      .where(eq(schema.numberSequences.entityType, s.entityType))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.numberSequences).values({
        entityType: s.entityType,
        prefix: s.prefix,
        suffix: s.suffix,
        padLength: s.padLength,
        nextNumber: 1,
        resetPolicy: "never",
        dateSegment: "omit",
      });
      console.log("Inserted sequence:", s.entityType);
    }
  }

  const orgCount = await db.select().from(schema.organizations).limit(1);
  if (orgCount.length === 0) {
    await db.insert(schema.organizations).values({
      name: "請設定公司名稱",
      email: DEFAULT_ADMIN_EMAIL,
    });
    console.log("Inserted default organization row");
  }

  const [{ nLead }] = await db.select({ nLead: count() }).from(schema.customerLeadSources);
  if (Number(nLead ?? 0) === 0) {
    const t = new Date();
    await db.insert(schema.customerLeadSources).values([
      { name: "官網／搜尋", sortOrder: 10, isActive: true, updatedAt: t },
      { name: "轉介紹", sortOrder: 20, isActive: true, updatedAt: t },
      { name: "展會／活動", sortOrder: 30, isActive: true, updatedAt: t },
      { name: "其他", sortOrder: 99, isActive: true, updatedAt: t },
    ]);
    console.log("Inserted default customer lead sources");
  }

  const [{ nGrp }] = await db.select({ nGrp: count() }).from(schema.customerGroups);
  if (Number(nGrp ?? 0) === 0) {
    const t = new Date();
    await db.insert(schema.customerGroups).values([
      { name: "一般企業", sortOrder: 10, isActive: true, updatedAt: t },
      { name: "重點客戶", sortOrder: 20, isActive: true, updatedAt: t },
      { name: "待培育", sortOrder: 30, isActive: true, updatedAt: t },
    ]);
    console.log("Inserted default customer groups");
  }

  const [{ nFu }] = await db.select({ nFu: count() }).from(schema.customerFollowUpStatuses);
  if (Number(nFu ?? 0) === 0) {
    const t = new Date();
    await db.insert(schema.customerFollowUpStatuses).values([
      { name: "初次接洽", sortOrder: 10, isActive: true, updatedAt: t },
      { name: "需求確認", sortOrder: 20, isActive: true, updatedAt: t },
      { name: "報價／評估", sortOrder: 30, isActive: true, updatedAt: t },
      { name: "成交", sortOrder: 40, isActive: true, updatedAt: t },
      { name: "暫緩／培育", sortOrder: 50, isActive: true, updatedAt: t },
    ]);
    console.log("Inserted default follow-up statuses");
  }

  const [{ userCount }] = await db.select({ userCount: count() }).from(schema.users);
  if (Number(userCount ?? 0) === 0) {
    const [superRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.slug, "super_admin"))
      .limit(1);
    if (!superRole) {
      throw new Error("super_admin role missing; seed roles first.");
    }
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    const [created] = await db
      .insert(schema.users)
      .values({
        email: DEFAULT_ADMIN_EMAIL,
        passwordHash,
        name: "Administrator",
      })
      .returning({ id: schema.users.id });
    if (created) {
      await db.insert(schema.userRoles).values({
        userId: created.id,
        roleId: superRole.id,
      });
    }
    console.log(
      `Created dev admin — Email: ${DEFAULT_ADMIN_EMAIL}  Password: ${DEFAULT_ADMIN_PASSWORD}  (change before production)`
    );
  }

  if (ensureDevAdmin) {
    await ensureDevAdminAccount();
  }

  const [adminForOrg] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL))
    .limit(1);
  const [primaryOrg] = await db.select().from(schema.organizations).orderBy(asc(schema.organizations.id)).limit(1);
  if (adminForOrg && primaryOrg && primaryOrg.linkedUserId !== adminForOrg.id) {
    await db
      .update(schema.organizations)
      .set({ linkedUserId: adminForOrg.id, updatedAt: new Date() })
      .where(eq(schema.organizations.id, primaryOrg.id));
    console.log(`Linked enterprise profile steward to ${DEFAULT_ADMIN_EMAIL}`);
  }

  const [{ nPtLook }] = await db.select({ nPtLook: count() }).from(schema.ptMasterLookupEntries);
  if (Number(nPtLook ?? 0) === 0) {
    const t = new Date();
    await db.insert(schema.ptMasterLookupEntries).values([
      { dictionaryKindSlug: "payment_terms", label: "款到發貨", sortOrder: 10, isActive: true, updatedAt: t },
      { dictionaryKindSlug: "payment_terms", label: "月結 30 天", sortOrder: 20, isActive: true, updatedAt: t },
      { dictionaryKindSlug: "shipping_methods", label: "海運整櫃", sortOrder: 10, isActive: true, updatedAt: t },
      { dictionaryKindSlug: "shipping_methods", label: "空運寄送", sortOrder: 20, isActive: true, updatedAt: t },
    ]);
    console.log("Inserted default PT lookup entries");
  }

  const [{ nPtCur }] = await db.select({ nPtCur: count() }).from(schema.ptCurrencies);
  if (Number(nPtCur ?? 0) === 0) {
    const t = new Date();
    await db.insert(schema.ptCurrencies).values([
      { isoCode: "TWD", label: "新台幣", quoteTwdPerUnit: null, sortOrder: 0, isActive: true, updatedAt: t },
      { isoCode: "USD", label: "美元", quoteTwdPerUnit: "32", sortOrder: 10, isActive: true, updatedAt: t },
    ]);
    console.log("Inserted default PT currencies");
  }

  await ensureDemoCustomers();

  console.log("Seed done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
