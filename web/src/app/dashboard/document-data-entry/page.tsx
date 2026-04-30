import { redirect } from "next/navigation";

/** 舊路徑統一導向報價單子頁（與原預設分頁一致） */
export default function DocumentDataEntryIndexPage() {
  redirect("/dashboard/document-data-entry/quotations");
}
