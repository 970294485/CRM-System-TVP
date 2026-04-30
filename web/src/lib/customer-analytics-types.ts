export type CustomerGrowthTrendRow = { month: string; newCustomers: number };
export type CustomerIndustryRow = { industry: string | null; count: number };
export type CustomerTopRevenueRow = { name: string; totalRevenue: number };

export type CustomerAnalyticsResponse = {
  growthTrend: CustomerGrowthTrendRow[];
  industryDistribution: CustomerIndustryRow[];
  topCustomers: CustomerTopRevenueRow[];
};
