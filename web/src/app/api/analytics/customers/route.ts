import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import type {
  CustomerAnalyticsResponse,
  CustomerGrowthTrendRow,
  CustomerIndustryRow,
  CustomerTopRevenueRow,
} from "@/lib/customer-analytics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecordArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function normalizeMonth(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL 未設定" }, { status: 503 });
  }

  try {
    const sql = getNeonSql();

    const [growthRaw, industryRaw, topRaw] = await Promise.all([
      sql.query(`
        SELECT DATE_TRUNC('month', created_at) AS month,
               COUNT(id)::int AS new_customers
        FROM customers
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      sql.query(`
        SELECT industry,
               COUNT(id)::int AS count
        FROM customers
        GROUP BY industry
        ORDER BY count DESC
      `),
      sql.query(`
        SELECT c.name,
               SUM(q.total_amount)::float8 AS total_revenue
        FROM customers c
        JOIN quotations q ON c.id = q.customer_id
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
        LIMIT 5
      `),
    ]);

    const growthTrend: CustomerGrowthTrendRow[] = asRecordArray(growthRaw).map((r) => ({
      month: normalizeMonth(r.month),
      newCustomers: Number(r.new_customers ?? 0),
    }));

    const industryDistribution: CustomerIndustryRow[] = asRecordArray(industryRaw).map((r) => ({
      industry: r.industry === null || r.industry === undefined ? null : String(r.industry),
      count: Number(r.count ?? 0),
    }));

    const topCustomers: CustomerTopRevenueRow[] = asRecordArray(topRaw).map((r) => ({
      name: String(r.name ?? ""),
      totalRevenue: Number(r.total_revenue ?? 0),
    }));

    const body: CustomerAnalyticsResponse = {
      growthTrend,
      industryDistribution,
      topCustomers,
    };

    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = /industry|customer_code|customer_status|column/i.test(msg)
      ? "若尚未擴充欄位，請執行：npm run db:apply:customer-analytics"
      : /quotations/i.test(msg)
        ? "請確認已建立 quotations 表（例如 npm run db:apply:documents-init）"
        : undefined;
    console.error("[GET /api/analytics/customers]", msg);
    return NextResponse.json(
      {
        error: "無法載入客戶分析資料",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
