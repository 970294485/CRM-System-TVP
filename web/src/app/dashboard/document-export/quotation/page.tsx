import { QuotationServer } from "@/components/sales/quotation-server";

export default async function ExportQuotationPage() {
  return (
    <QuotationServer
      headingTitle="導出 QUOTATION"
      headingDescription="報價單列表與 PDF／列印預覽；資料與「銷售管理 › 報價單功能」相同。"
    />
  );
}
