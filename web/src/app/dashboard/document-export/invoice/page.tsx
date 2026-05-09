import { ProformaInvoicesServer } from "@/components/sales/proforma-invoices-server";

export default async function ExportInvoicePage() {
  return (
    <ProformaInvoicesServer
      headingTitle="導出 INVOICE"
      headingDescription="預收發票列表與 PDF 下載；資料與「銷售管理 › 預收發票」相同，由銷售合同一鍵開立。"
    />
  );
}
