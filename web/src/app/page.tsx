import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginView } from "@/components/login-view";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return <LoginView />;
}
