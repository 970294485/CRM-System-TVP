"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  CustomerAnalyticsResponse,
  CustomerIndustryRow,
} from "@/lib/customer-analytics-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b", "#ec4899"];

function formatMonthLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function IndustryPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: unknown }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!;
  const value = Number(p.value ?? 0);
  const label = p.name != null ? String(p.name) : "—";
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        數量：<span className="font-mono tabular-nums">{value}</span>
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        占比：<span className="font-mono tabular-nums">{pct}%</span>
      </p>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50/80 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      {message}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-3">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mx-auto h-[260px] w-[260px] rounded-full" />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerAnalyticsDashboard() {
  const [data, setData] = useState<CustomerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/customers", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : `載入失敗（${res.status}）`;
        const hint = typeof json?.hint === "string" ? `\n${json.hint}` : "";
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : "";
        throw new Error(msg + hint + detail);
      }
      setData(json as CustomerAnalyticsResponse);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "無法載入資料");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pieData = useMemo(() => {
    const rows: CustomerIndustryRow[] = data?.industryDistribution ?? [];
    return rows.map((r) => ({
      name: r.industry?.trim() ? r.industry : "（未填產業）",
      value: r.count,
    }));
  }, [data?.industryDistribution]);

  const industryTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData]);

  const barData = useMemo(() => {
    const rows = data?.topCustomers ?? [];
    return rows.map((r) => ({
      name: r.name,
      totalRevenue: r.totalRevenue,
    }));
  }, [data?.topCustomers]);

  const lineData = useMemo(() => {
    const rows = data?.growthTrend ?? [];
    return rows.map((r) => ({
      monthLabel: formatMonthLabel(r.month),
      newCustomers: r.newCustomers,
    }));
  }, [data?.growthTrend]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-medium">載入失敗</p>
        <p className="mt-1 whitespace-pre-wrap">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-white hover:bg-red-800"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>客戶增長趨勢</CardTitle>
          <CardDescription>依月份統計新增客戶數</CardDescription>
        </CardHeader>
        <CardContent>
          {lineData.length === 0 ? (
            <ChartEmpty message="尚無客戶建檔資料，無法繪製增長曲線。" />
          ) : (
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgb(228 228 231)",
                      background: "white",
                    }}
                    labelFormatter={(l) => `月份：${l}`}
                    formatter={(v) => [v, "新增客戶"]}
                  />
                  <Line type="monotone" dataKey="newCustomers" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>產業分佈</CardTitle>
          <CardDescription>依產業別客戶數占比（含自訂 Tooltip）</CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 || industryTotal === 0 ? (
            <ChartEmpty message="尚無產業欄位資料或客戶數為零。" />
          ) : (
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]!} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => (
                      <IndustryPieTooltip
                        active={active}
                        payload={payload as Array<{ value?: number; name?: unknown }> | undefined}
                        total={industryTotal}
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>高價值客戶 Top 5</CardTitle>
          <CardDescription>依報價單 total_amount 加總（僅含已關聯 customer_id 之報價）</CardDescription>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <ChartEmpty message="尚無與客戶主檔關聯的報價資料，或加總金額為零。" />
          ) : (
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barData}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal className="stroke-zinc-200 dark:stroke-zinc-700" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v))} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v)), "貢獻總額"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgb(228 228 231)",
                      background: "white",
                    }}
                  />
                  <Bar dataKey="totalRevenue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
