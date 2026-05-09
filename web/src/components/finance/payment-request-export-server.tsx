import { asc } from "drizzle-orm";

import { auth } from "@/auth";
import { PaymentRequestExportWorkspace } from "@/components/finance/payment-request-export-workspace";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";

export async function PaymentRequestExportServer() {
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
    <PaymentRequestExportWorkspace
      org={orgProps}
      bankName={org?.bankName ?? null}
      bankAccount={org?.bankAccount ?? null}
    />
  );
}
