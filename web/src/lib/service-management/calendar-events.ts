import { and, desc, eq, gt, gte, ilike, inArray, isNotNull, lt } from "drizzle-orm";

import { getDb } from "@/db";
import {
  customerServiceCases,
  customers,
  serviceResourceBookings,
  serviceResourceVenues,
  users,
} from "@/db/schema";

export type CalendarBookingEvent = {
  kind: "booking";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  staffUserId: string | null;
  staffName: string | null;
  staffEmail: string | null;
  venueName: string | null;
  caseNo: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerNameSnapshot: string | null;
  notes: string | null;
  purchaseNote: string | null;
};

export type CalendarCaseEvent = {
  kind: "assigned_case_marker";
  id: string;
  caseNo: string;
  title: string;
  /** All-day anchor: UTC midnight of the calendar day derived from updatedAt */
  dayStartUtc: string;
  status: string;
  priority: string;
  assignedToUserId: string;
  assignedToName: string | null;
  customerNameSnapshot: string;
  summary: string | null;
  anchorAt: string;
};

export type CalendarGatherParams = {
  from: Date;
  to: Date;
  scope: "all" | "mine";
  userId: string;
  /** Booking title search (ILIKE %%), optional */
  q?: string;
};

function missingCalendarHint(msg: string): string | undefined {
  if (
    /service_resource_bookings|service_resource_venues|customer_service_cases|relation|does not exist/i.test(msg)
  ) {
    return "請在 web 依序套用 db:apply:customer-service-init 與 db:apply:service-resource-booking-init";
  }
  return undefined;
}

export { missingCalendarHint };

type Db = ReturnType<typeof getDb>;

export async function gatherCalendarBookingEvents(db: Db, p: CalendarGatherParams): Promise<CalendarBookingEvent[]> {
  const overlap = and(
    lt(serviceResourceBookings.startsAt, p.to),
    gt(serviceResourceBookings.endsAt, p.from)
  );

  let scopeClause = overlap;
  if (p.scope === "mine") {
    scopeClause = and(
      overlap,
      eq(serviceResourceBookings.staffUserId, p.userId)
    )!;
  }

  let whereClause = scopeClause;

  const qTrim = (p.q ?? "").trim();
  if (qTrim.length > 0) {
    const pattern = `%${qTrim.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    whereClause = and(whereClause!, ilike(serviceResourceBookings.title, pattern))!;
  }

  const rows = await db
    .select({
      id: serviceResourceBookings.id,
      title: serviceResourceBookings.title,
      startsAt: serviceResourceBookings.startsAt,
      endsAt: serviceResourceBookings.endsAt,
      staffUserId: serviceResourceBookings.staffUserId,
      notes: serviceResourceBookings.notes,
      purchaseNote: serviceResourceBookings.purchaseNote,
      staffName: users.name,
      staffEmail: users.email,
      venueName: serviceResourceVenues.name,
      caseNo: customerServiceCases.caseNo,
      customerNameSnapshot: customerServiceCases.customerNameSnapshot,
      customerPhone: customers.phone,
      customerEmail: customers.email,
    })
    .from(serviceResourceBookings)
    .leftJoin(users, eq(serviceResourceBookings.staffUserId, users.id))
    .leftJoin(serviceResourceVenues, eq(serviceResourceBookings.venueId, serviceResourceVenues.id))
    .leftJoin(customerServiceCases, eq(serviceResourceBookings.customerServiceCaseId, customerServiceCases.id))
    .leftJoin(customers, eq(customerServiceCases.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(serviceResourceBookings.startsAt))
    .limit(500);

  return rows.map((r) => ({
    kind: "booking" as const,
    id: r.id,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    staffUserId: r.staffUserId,
    staffName: r.staffName,
    staffEmail: r.staffEmail,
    venueName: r.venueName,
    caseNo: r.caseNo,
    customerPhone: r.customerPhone ?? null,
    customerEmail: r.customerEmail ?? null,
    customerNameSnapshot: r.customerNameSnapshot ?? null,
    notes: r.notes,
    purchaseNote: r.purchaseNote,
  }));
}

/** 指派中之客服案件「節點」：區間內曾更新過的才列入（避免清單無限膨脹） */
export async function gatherAssignedCaseMarkers(db: Db, p: CalendarGatherParams): Promise<CalendarCaseEvent[]> {
  const statuses = ["open", "in_progress"];

  const parts = [
    inArray(customerServiceCases.status, statuses),
    gte(customerServiceCases.updatedAt, p.from),
    lt(customerServiceCases.updatedAt, p.to),
    isNotNull(customerServiceCases.assignedToUserId),
  ];

  if (p.scope === "mine") {
    parts.push(eq(customerServiceCases.assignedToUserId, p.userId));
  }

  const rows = await db
    .select({
      id: customerServiceCases.id,
      caseNo: customerServiceCases.caseNo,
      title: customerServiceCases.title,
      status: customerServiceCases.status,
      priority: customerServiceCases.priority,
      assignedToUserId: customerServiceCases.assignedToUserId,
      customerNameSnapshot: customerServiceCases.customerNameSnapshot,
      summary: customerServiceCases.summary,
      anchorAt: customerServiceCases.updatedAt,
      assignedToName: users.name,
    })
    .from(customerServiceCases)
    .innerJoin(users, eq(customerServiceCases.assignedToUserId, users.id))
    .where(and(...parts)!)
    .orderBy(desc(customerServiceCases.updatedAt))
    .limit(500);

  return rows
    .filter((r): r is typeof r & { assignedToUserId: string } => r.assignedToUserId != null)
    .map((r) => {
      const d = new Date(r.anchorAt);
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
      const dayStartUtc = new Date(dayStart).toISOString();
      return {
        kind: "assigned_case_marker" as const,
        id: r.id,
        caseNo: r.caseNo,
        title: r.title,
        dayStartUtc,
        status: r.status,
        priority: r.priority,
        assignedToUserId: r.assignedToUserId,
        assignedToName: r.assignedToName,
        customerNameSnapshot: r.customerNameSnapshot,
        summary: r.summary ?? null,
        anchorAt: r.anchorAt.toISOString(),
      };
    });
}
