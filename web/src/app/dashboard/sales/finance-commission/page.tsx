import { auth } from "@/auth";
import { SalesFinanceCommissionWorkspace } from "@/components/sales/sales-finance-commission-workspace";

export default async function SalesFinanceCommissionPage() {
  await auth();
  return <SalesFinanceCommissionWorkspace />;
}
