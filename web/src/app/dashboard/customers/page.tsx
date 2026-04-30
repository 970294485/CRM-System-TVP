import Link from "next/link";
import { asc, desc, eq, ilike, or } from "drizzle-orm";

import { auth } from "@/auth";
import {
  CustomersTable,
  type CustomerTableRow,
} from "@/components/customers/customers-table";
import { getDb } from "@/db";
import {
  customerFollowUpStatuses,
  customerGroups,
  customerLeadSources,
  customers,
  organizations,
  users,
} from "@/db/schema";
import { canEditSales } from "@/lib/authz";

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();
  const editable = canEditSales(session);
  const db = getDb();

  const term = (q ?? "").trim();
  const pattern = term ? `%${term}%` : null;

  const base = db
    .select({
      id: customers.id,
      name: customers.name,
      contactName: customers.contactName,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      organizationId: customers.organizationId,
      leadSourceId: customers.leadSourceId,
      customerGroupId: customers.customerGroupId,
      followUpStatusId: customers.followUpStatusId,
      lifecycle: customers.lifecycle,
      tags: customers.tags,
      valueTier: customers.valueTier,
      assignedToUserId: customers.assignedToUserId,
      notes: customers.notes,
      updatedAt: customers.updatedAt,
      leadSourceName: customerLeadSources.name,
      followUpName: customerFollowUpStatuses.name,
      groupName: customerGroups.name,
    })
    .from(customers)
    .leftJoin(customerLeadSources, eq(customers.leadSourceId, customerLeadSources.id))
    .leftJoin(customerFollowUpStatuses, eq(customers.followUpStatusId, customerFollowUpStatuses.id))
    .leftJoin(customerGroups, eq(customers.customerGroupId, customerGroups.id));

  const rawRows = pattern
    ? await base
        .where(
          or(
            ilike(customers.name, pattern),
            ilike(customers.contactName, pattern),
            ilike(customers.phone, pattern),
            ilike(customers.email, pattern)
          )
        )
        .orderBy(desc(customers.updatedAt))
        .limit(500)
    : await base.orderBy(desc(customers.updatedAt)).limit(500);

  const rows: CustomerTableRow[] = rawRows.map((r) => ({
    id: r.id,
    name: r.name,
    contactName: r.contactName,
    phone: r.phone,
    email: r.email,
    address: r.address,
    organizationId: r.organizationId,
    leadSourceId: r.leadSourceId,
    customerGroupId: r.customerGroupId,
    followUpStatusId: r.followUpStatusId,
    lifecycle: r.lifecycle,
    tags: Array.isArray(r.tags) ? r.tags : [],
    valueTier: r.valueTier,
    assignedToUserId: r.assignedToUserId,
    notes: r.notes,
    leadSourceName: r.leadSourceName,
    followUpName: r.followUpName,
    groupName: r.groupName,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));

  const [sources, groups, statuses, orgs, userRows] = await Promise.all([
    db.select().from(customerLeadSources).orderBy(asc(customerLeadSources.sortOrder), asc(customerLeadSources.name)),
    db.select().from(customerGroups).orderBy(asc(customerGroups.sortOrder), asc(customerGroups.name)),
    db
      .select()
      .from(customerFollowUpStatuses)
      .orderBy(asc(customerFollowUpStatuses.sortOrder), asc(customerFollowUpStatuses.name)),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).orderBy(asc(organizations.name)),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(asc(users.name)),
  ]);

  const userOptions = userRows.map((u) => ({ id: u.id, label: `${u.name}（${u.email}）` }));

  return (
    <div>
      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          placeholder="搜尋…"
          defaultValue={term}
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          搜尋
        </button>
        {term ? (
          <Link href="/dashboard/customers" className="rounded-lg px-4 py-2 text-sm text-zinc-600">
            清除
          </Link>
        ) : null}
      </form>

      <CustomersTable
        rows={rows}
        sources={sources.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
        groups={groups.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
        statuses={statuses.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
        dictionaryGroups={groups.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        }))}
        dictionaryStatuses={statuses.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        }))}
        dictionarySources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        }))}
        orgs={orgs}
        users={userOptions}
        editable={editable}
        hasActiveSearch={!!term}
      />
    </div>
  );
}
