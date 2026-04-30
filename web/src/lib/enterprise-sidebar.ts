import { asc, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

const { organizations, users } = schema;

export type EnterpriseSidebarBanner = {
  companyName: string;
  metaLine?: string;
  stewardEmailLabel?: string;
};

export async function getEnterpriseSidebarBanner(
  db: NeonHttpDatabase<typeof schema>
): Promise<EnterpriseSidebarBanner | null> {
  const [org] = await db.select().from(organizations).orderBy(asc(organizations.id)).limit(1);
  if (!org) return null;

  let stewardEmailLabel: string | undefined;
  if (org.linkedUserId) {
    const [linked] = await db.select({ email: users.email }).from(users).where(eq(users.id, org.linkedUserId)).limit(1);
    stewardEmailLabel = linked?.email ? `主檔綁定 ${linked.email}` : undefined;
  }

  const parts = [org.taxId ?? "", org.phone ?? ""].map((s) => s.trim()).filter(Boolean);

  return {
    companyName: org.name,
    metaLine: parts.length ? parts.join(" · ") : undefined,
    stewardEmailLabel,
  };
}
