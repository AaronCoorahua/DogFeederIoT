import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (cookieStore.get("df_auth")?.value === "1") {
    redirect("/");
  }
  return <LoginForm />;
}
