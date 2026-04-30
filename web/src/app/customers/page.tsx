import { redirect } from "next/navigation";

export default function CustomersLegacyRedirect() {
  redirect("/dashboard/customers");
}
