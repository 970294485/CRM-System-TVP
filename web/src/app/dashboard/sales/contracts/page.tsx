import { asc } from "drizzle-orm";

import { auth } from "@/auth";
import { ContractsWorkspace } from "@/components/sales/contracts-workspace";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";

export default async function SalesContractsPage() {
  await auth();
  const db = getDb();
  const [org] = await db.select().from(organizations).orderBy(asc(organizations.id)).limit(1);

  const orgProps = org
    ? {
        name: org.name,
        taxId: org.taxId,
        address: org.address,
        phone: org.phone,
        email: org.email,
      }
    : null;

  return <ContractsWorkspace org={orgProps} />;
}
