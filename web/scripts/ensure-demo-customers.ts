/**
 * 兩筆客戶列表測試資料（依客戶名稱冪等，已存在則跳過）。
 */
import { asc, eq } from "drizzle-orm";

import { getDb } from "../src/db/index";
import * as schema from "../src/db/schema";

export async function ensureDemoCustomers(): Promise<void> {
  const db = getDb();
  const demos: {
    name: string;
    contactName: string;
    phone: string;
    email: string;
    lifecycle: "negotiating" | "active";
  }[] = [
    {
      name: "測試客戶 A（示範）",
      contactName: "王小明",
      phone: "0912-111-222",
      email: "demo-customer-a@example.com",
      lifecycle: "negotiating",
    },
    {
      name: "測試客戶 B（示範）",
      contactName: "李美華",
      phone: "0923-333-444",
      email: "demo-customer-b@example.com",
      lifecycle: "active",
    },
  ];

  const [org] = await db.select().from(schema.organizations).orderBy(asc(schema.organizations.id)).limit(1);
  const [lead] = await db
    .select()
    .from(schema.customerLeadSources)
    .orderBy(asc(schema.customerLeadSources.sortOrder))
    .limit(1);
  const [grp] = await db
    .select()
    .from(schema.customerGroups)
    .orderBy(asc(schema.customerGroups.sortOrder))
    .limit(1);
  const [fu] = await db
    .select()
    .from(schema.customerFollowUpStatuses)
    .orderBy(asc(schema.customerFollowUpStatuses.sortOrder))
    .limit(1);
  const [user] = await db.select().from(schema.users).orderBy(asc(schema.users.id)).limit(1);

  for (const d of demos) {
    const [existing] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.name, d.name))
      .limit(1);
    if (existing) continue;

    await db.insert(schema.customers).values({
      customerCode: d.name.includes("A") ? "DEMO-CUST-A" : "DEMO-CUST-B",
      industry: d.name.includes("A") ? "資訊科技" : "批發零售",
      region: d.name.includes("A") ? "北部" : "中部",
      customerStatus: "Active",
      name: d.name,
      contactName: d.contactName,
      phone: d.phone,
      email: d.email,
      organizationId: org?.id ?? null,
      leadSourceId: lead?.id ?? null,
      customerGroupId: grp?.id ?? null,
      followUpStatusId: fu?.id ?? null,
      lifecycle: d.lifecycle,
      tags: ["示範資料"],
      valueTier: "medium",
      assignedToUserId: user?.id ?? null,
      notes: "由 db:seed / db:seed:customers-demo 寫入的測試資料，可於列表中刪除。",
    });
    console.log("Inserted demo customer:", d.name);
  }
}
