import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** 公開入口：`/` 在未登入時一律導向登入頁；已登入則進儀表板（中間件會先擋一层，這裡作為後備）。 */
export default async function Home() {
  const session = await auth();
  if (session?.user?.email) {
    redirect("/dashboard");
  }
  redirect("/login");
}
