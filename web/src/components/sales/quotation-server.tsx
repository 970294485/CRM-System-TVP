import { asc } from "drizzle-orm";

import { auth } from "@/auth";
import { QuotationWorkspace } from "@/components/sales/quotation-workspace";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";

export type QuotationServerProps = {
  headingTitle?: string;
  headingDescription?: string;
};

export async function QuotationServer({
  headingTitle,
  headingDescription,
}: QuotationServerProps = {}) {
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

  return (
    <QuotationWorkspace
      org={orgProps}
      headingTitle={headingTitle}
      headingDescription={headingDescription}
    />
  );
}
