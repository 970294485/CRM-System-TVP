import { redirect } from "next/navigation";

/** 已改為列表頁彈窗新增 */
export default function NewCustomerLegacyRedirect() {
  redirect("/dashboard/customers");
}
